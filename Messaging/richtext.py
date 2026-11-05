"""Formatted message bodies: cleaning on the way in, signed links on the way out.

Every body_html is cleaned with an allowlist before it is stored, so stored
HTML can never carry scripts, event handlers, iframes, forms or remote
images. Pictures inside a message are stored as ``inline:<uuid>`` and turned
into short-lived signed download links only when a participant reads them.
"""
import html as html_lib
import re

import nh3

MAX_HTML_CHARS = 1_000_000

TAGS = {
    'p', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'sub', 'sup', 'mark', 'code', 'pre',
    'h1', 'h2', 'h3', 'h4', 'blockquote',
    'ul', 'ol', 'li',
    'a', 'img',
    'table', 'colgroup', 'col', 'thead', 'tbody', 'tr', 'th', 'td',
}

ATTRIBUTES = {
    '*': {'style'},
    'a': {'href', 'title'},
    'img': {'src', 'alt', 'width', 'height'},
    'ol': {'start'},
    'td': {'colspan', 'rowspan'},
    'th': {'colspan', 'rowspan'},
    'col': {'span'},
    'mark': {'data-color'},
}

STYLE_PROPERTIES = {
    'color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style',
    'text-decoration', 'text-align', 'margin-left', 'padding-left', 'width', 'min-width',
}

UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
# What the editor may send for a picture: our marker, or a download link we issued.
INLINE_SRC = re.compile(rf'^(?:inline:|(?:https?://[^/\s]+)?/api/messaging/files/inline/)({UUID})', re.I)
INLINE_MARKER = re.compile(rf'inline:({UUID})', re.I)


def _attribute_filter(tag, attr, value):
    if tag == 'img' and attr == 'src':
        match = INLINE_SRC.match(value.strip())
        return f'inline:{match.group(1).lower()}' if match else None  # only our own pictures
    if attr == 'href' and value.strip().lower().startswith('inline:'):
        return None
    return value


def clean_html(raw):
    """Allowlisted HTML safe to store and display. Raises ValueError if too large."""
    raw = raw or ''
    if len(raw) > MAX_HTML_CHARS:
        raise ValueError('Message is too long.')
    cleaned = nh3.clean(
        raw,
        tags=TAGS,
        attributes=ATTRIBUTES,
        attribute_filter=_attribute_filter,
        filter_style_properties=STYLE_PROPERTIES,
        url_schemes={'http', 'https', 'mailto', 'inline'},
        link_rel='noopener noreferrer nofollow',
        strip_comments=True,
    )
    # Pictures whose source was not one of ours lose their src; drop them entirely.
    return re.sub(r'<img(?![^>]*\ssrc=)[^>]*>', '', cleaned).strip()


_BLOCK_START = re.compile(r'(<(?:p|div|h[1-4]|ul|ol|li|blockquote|table|tr|pre|hr)\b)', re.I)
_BLOCK_END = re.compile(r'</(p|div|h[1-4]|li|blockquote|tr|pre)>|<br\s*/?>', re.I)


def html_to_text(cleaned):
    """Plain-text version of cleaned HTML, keeping line breaks between blocks."""
    text = _BLOCK_START.sub(r'\n\1', cleaned or '')
    text = _BLOCK_END.sub('\n', text)
    text = re.sub(r'</t[dh]>', '\t', text, flags=re.I)
    text = html_lib.unescape(nh3.clean(text, tags=set()))
    text = text.replace('\xa0', ' ')
    text = re.sub(r'[ \t]*\n[ \t]*', '\n', text)
    return re.sub(r'\n{2,}', '\n', text).strip()


def inline_image_ids(cleaned):
    """UUIDs of the pictures a cleaned body refers to."""
    return {m.lower() for m in INLINE_MARKER.findall(cleaned or '')}


def with_signed_images(cleaned, sign):
    """Replace ``inline:<uuid>`` markers with links from ``sign(uuid)``."""
    return INLINE_MARKER.sub(lambda m: html_lib.escape(sign(m.group(1).lower()), quote=True), cleaned or '')


def text_to_html(text):
    """HTML for a plain-text body (older messages, plain replies)."""
    paragraphs = [p for p in re.split(r'\n{2,}', (text or '').strip()) if p]
    return ''.join(f'<p>{html_lib.escape(p).replace(chr(10), "<br>")}</p>' for p in paragraphs)
