import dateutil.parser
from django.db.models import Q
from datetime import datetime, timedelta
from .registry import get_field_registry

class QueryCompiler:
    def __init__(self, model_name, filter_tree):
        self.registry = {f['key']: f for f in get_field_registry(model_name)}
        self.filter_tree = filter_tree
        self.errors = []

    def compile(self):
        if not self.filter_tree or not isinstance(self.filter_tree, dict):
            return Q()
        try:
            return self._parse_node(self.filter_tree)
        except Exception as e:
            self.errors.append(str(e))
            return Q()

    def _parse_node(self, node):
        if 'operator' in node and node['operator'] in ['AND', 'OR'] and 'conditions' in node:
            q = Q()
            is_empty = True
            for child in node['conditions']:
                child_q = self._parse_node(child)
                # If child_q is empty Q() we shouldn't necessarily AND/OR it if it has no effect, 
                # but Q() & Q(x=1) is Q(x=1)
                if node['operator'] == 'AND':
                    q &= child_q
                else:
                    q |= child_q
                is_empty = False
            return q
        else:
            return self._compile_rule(node)

    def _compile_rule(self, rule):
        key = rule.get('field')
        op = rule.get('operator')
        val = rule.get('value')
        
        if not key or not op:
            return Q()

        if key not in self.registry:
            self.errors.append(f"Field '{key}' is not in the registry.")
            return Q()
            
        field_info = self.registry[key]
        orm_field = field_info['field']
        ftype = field_info['type']
        
        if op not in field_info['operators']:
            self.errors.append(f"Operator '{op}' not allowed for field '{key}'.")
            return Q()

        lookup = orm_field
        
        # Early exit for empty conditions
        if val is None or str(val).strip() == '':
            if op not in ['is_empty', 'is_not_empty', 'today', 'yesterday', 'this_week', 'this_month', 'this_year']:
                return Q()

        if ftype == 'text':
            if op == 'equals': pass
            elif op == 'not_equals': return ~Q(**{orm_field: val})
            elif op == 'contains': lookup += "__icontains"
            elif op == 'does_not_contain': return ~Q(**{f"{orm_field}__icontains": val})
            elif op == 'starts_with': lookup += "__istartswith"
            elif op == 'ends_with': lookup += "__iendswith"
            elif op == 'is_empty': return Q(**{f"{orm_field}__isnull": True}) | Q(**{f"{orm_field}__exact": ""})
            elif op == 'is_not_empty': return ~(Q(**{f"{orm_field}__isnull": True}) | Q(**{f"{orm_field}__exact": ""}))
            
        elif ftype == 'number':
            if op == 'between':
                try: 
                    v1, v2 = str(val).split(',')
                    return Q(**{f"{orm_field}__gte": float(v1.strip()), f"{orm_field}__lte": float(v2.strip())})
                except: return Q()

            try: val = float(val)
            except ValueError: self.errors.append(f"Invalid number for {key}"); return Q()
            
            if op == 'equals': pass
            elif op == 'not_equals': return ~Q(**{orm_field: val})
            elif op == 'greater_than': lookup += "__gt"
            elif op == 'greater_than_or_equal': lookup += "__gte"
            elif op == 'less_than': lookup += "__lt"
            elif op == 'less_than_or_equal': lookup += "__lte"
                
        elif ftype == 'date':
            if op in ['today', 'yesterday', 'this_week', 'this_month', 'this_year', 'last_n_days', 'next_n_days']:
                val = self._compute_dynamic_date(op, val)
                if isinstance(val, tuple):
                    return Q(**{f"{orm_field}__gte": val[0], f"{orm_field}__lte": val[1]})
                elif val:
                    pass
                else:
                    return Q()
            elif op == 'between':
                try:
                    v1, v2 = str(val).split(',')
                    d1 = dateutil.parser.parse(v1.strip()).date()
                    d2 = dateutil.parser.parse(v2.strip()).date()
                    return Q(**{f"{orm_field}__gte": d1, f"{orm_field}__lte": d2})
                except: return Q()
            else:
                try: val = dateutil.parser.parse(str(val)).date() if val else None
                except: self.errors.append(f"Invalid date for {key}"); return Q()
                
            if op == 'equals': pass
            elif op == 'before': lookup += "__lt"
            elif op == 'after': lookup += "__gt"
            elif op == 'on_or_before': lookup += "__lte"
            elif op == 'on_or_after': lookup += "__gte"
            
        elif ftype == 'choice':
            if op == 'equals': pass
            elif op == 'not_equals': return ~Q(**{orm_field: val})
            elif op == 'in': 
                lookup += "__in"
                val = [v.strip() for v in str(val).split(',')]
            elif op == 'not_in':
                return ~Q(**{f"{orm_field}__in": [v.strip() for v in str(val).split(',')]})
                
        elif ftype == 'boolean':
            if op == 'is_true': val = True
            elif op == 'is_false': val = False

        return Q(**{lookup: val})

    def _compute_dynamic_date(self, op, val):
        today = datetime.now().date()
        if op == 'today': return today
        if op == 'yesterday': return today - timedelta(days=1)
        if op == 'this_week':
            start = today - timedelta(days=today.weekday())
            return (start, start + timedelta(days=6))
        if op == 'this_month':
            start = today.replace(day=1)
            # Rough end of month
            end = (start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            return (start, end)
        if op == 'this_year':
            return (today.replace(month=1, day=1), today.replace(month=12, day=31))
        if op == 'last_n_days':
            try: n = int(val)
            except: n = 0
            return (today - timedelta(days=n), today)
        if op == 'next_n_days':
            try: n = int(val)
            except: n = 0
            return (today, today + timedelta(days=n))
        return None
