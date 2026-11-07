"""
Runs a report request: validates it against the catalogue, scopes it to the
user, and turns it into one SQL query.

    request = {
        "source": "inmates",
        "columns": ["prison_number", "surname", "current_class"],   # display order
        "filters": {"operator": "AND", "conditions": [...]},         # optional
        "sort": [{"key": "surname", "direction": "asc"}],            # optional
    }
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass
from decimal import Decimal

from Auth.scoping import people_scope

from .catalogue import SOURCES, Column, OPERATORS, Source, can_use, column_choices
from .compiler import QueryCompiler

MAX_COLUMNS = 40
PREVIEW_MAX_PAGE_SIZE = 200
EXPORT_MAX_ROWS = 10_000


class ReportError(Exception):
    """A request the user must correct; `status` is the HTTP status to answer with."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


@dataclass
class PreparedReport:
    source: Source
    columns: list          # Column objects, in display order
    queryset: object       # ordered QuerySet, not yet evaluated
    sort: list             # [{"key", "direction"}]
    filters: dict

    def labels(self):
        return [c.label for c in self.columns]


def _filter_keys(node, found=None):
    found = set() if found is None else found
    if isinstance(node, dict):
        if node.get("operator") in ("AND", "OR") and isinstance(node.get("conditions"), list):
            for child in node["conditions"]:
                _filter_keys(child, found)
        elif node.get("field"):
            found.add(node["field"])
    return found


def resolve_source(user, source_key) -> Source:
    source = SOURCES.get(source_key or "")
    if source is None:
        raise ReportError("Unknown report source.", status=404)
    if not can_use(user, source):
        # Same answer whether or not it exists elsewhere: the user may not use it.
        raise ReportError("Your role does not have access to this report.", status=403)
    return source


def prepare(user, payload) -> PreparedReport:
    source = resolve_source(user, payload.get("source"))

    keys = payload.get("columns") or []
    if not isinstance(keys, list) or not keys:
        raise ReportError("Choose at least one column.")
    if len(keys) > MAX_COLUMNS:
        raise ReportError(f"A report can have at most {MAX_COLUMNS} columns.")
    if len(set(keys)) != len(keys):
        raise ReportError("A column can appear only once.")
    columns = []
    for key in keys:
        column = source.column(key)
        if column is None:
            raise ReportError(f"'{key}' is not a column of the {source.label} report.")
        columns.append(column)

    sort = payload.get("sort") or [{"key": k, "direction": d} for k, d in source.default_sort]
    if not isinstance(sort, list):
        raise ReportError("Invalid sort order.")
    sort_columns = []
    for item in sort[:3]:
        column = source.column((item or {}).get("key"))
        direction = (item or {}).get("direction", "asc")
        if column is None or direction not in ("asc", "desc"):
            raise ReportError("Sort by a column of this report, ascending or descending.")
        sort_columns.append((column, direction))

    filters = payload.get("filters") or {}
    filter_columns = []
    for key in _filter_keys(filters):
        column = source.column(key)
        if column is None:
            raise ReportError(f"Cannot filter on '{key}': it is not a column of this report.")
        filter_columns.append(column)

    queryset = source.model_class.objects.all()
    queryset = source.scope(queryset, people_scope(user))

    # Only the subqueries this report actually uses.
    needed = {c.key: c for c in [*columns, *(c for c, _ in sort_columns), *filter_columns]}
    annotations = {c.path: c.annotate() for c in needed.values() if c.annotate}
    if annotations:
        queryset = queryset.annotate(**annotations)

    registry = {
        c.key: {"field": c.path, "type": c.type, "operators": OPERATORS[c.type]}
        for c in source.columns
    }
    compiler = QueryCompiler(registry, filters)
    condition = compiler.compile()
    if compiler.errors:
        raise ReportError("Check the filters: " + "; ".join(compiler.errors))
    queryset = queryset.filter(condition)

    ordering = [("-" if d == "desc" else "") + c.path for c, d in sort_columns] + ["pk"]
    queryset = queryset.order_by(*ordering)

    return PreparedReport(
        source=source,
        columns=columns,
        queryset=queryset,
        sort=[{"key": c.key, "direction": d} for c, d in sort_columns],
        filters=filters,
    )


# --------------------------------------------------------------------------- values

def _choice_maps(report: PreparedReport):
    maps = {}
    for column in report.columns:
        choices = column_choices(report.source, column)
        if choices:
            maps[column.key] = {c["value"]: c["label"] for c in choices}
    return maps


def display_value(column: Column, value, choice_map=None):
    """Value as shown on screen and in CSV/PDF."""
    if value is None or value == "":
        return ""
    if column.type == "boolean":
        return "Yes" if value else "No"
    if column.type == "choice" and choice_map:
        return choice_map.get(value, value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    return value


def rows(report: PreparedReport, *, offset=0, limit=None, raw=False):
    """Rows in column order. `raw` keeps dates and numbers typed (for Excel)."""
    maps = _choice_maps(report)
    queryset = report.queryset.values_list(*[c.path for c in report.columns])
    if limit is not None:
        queryset = queryset[offset:offset + limit]
    for values in queryset.iterator(chunk_size=500):
        out = []
        for column, value in zip(report.columns, values):
            if raw and column.type in ("date", "number") and value is not None:
                out.append(float(value) if isinstance(value, Decimal) else value)
            else:
                out.append(display_value(column, value, maps.get(column.key)))
        yield out


def describe_filters(report: PreparedReport) -> str:
    """Plain-language summary of the filters, printed on exports."""
    labels = {c.key: c.label for c in report.source.columns}

    def walk(node):
        if not isinstance(node, dict):
            return ""
        if node.get("operator") in ("AND", "OR") and isinstance(node.get("conditions"), list):
            parts = [p for p in (walk(c) for c in node["conditions"]) if p]
            if not parts:
                return ""
            joined = f" {node['operator'].lower()} ".join(parts)
            return f"({joined})" if len(parts) > 1 else joined
        if not node.get("field"):
            return ""
        operator = str(node.get("operator", "")).replace("_", " ")
        value = node.get("value")
        value = "" if value in (None, "") else f" {value}"
        return f"{labels.get(node['field'], node['field'])} {operator}{value}"

    return walk(report.filters) or "None"
