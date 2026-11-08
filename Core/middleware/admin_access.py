"""Limits the Django admin to listed addresses (settings.ADMIN_ALLOWED_IPS).

Requests to /admin/ from anywhere else get a plain 404, so the page does not
even confirm it exists. An empty list allows any address; the admin is then
protected by staff accounts and the sign-in throttle only.

The address comes from Auth.sessions.client_ip, which trusts only the header
nginx sets, so it cannot be forged by the client.
"""
import ipaddress
import logging

from django.conf import settings
from django.http import Http404

logger = logging.getLogger(__name__)

ADMIN_PREFIX = '/admin/'


def _networks():
    networks = []
    for entry in getattr(settings, 'ADMIN_ALLOWED_IPS', []) or []:
        entry = entry.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            logger.error('ADMIN_ALLOWED_IPS: ignoring invalid entry %r', entry)
    return networks


def admin_allowed(ip) -> bool:
    networks = _networks()
    if not networks:
        return True
    if not ip:
        return False
    address = ipaddress.ip_address(ip)
    return any(address in network for network in networks)


class AdminAccessMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith(ADMIN_PREFIX):
            from Auth.sessions import client_ip
            ip = client_ip(request)
            if not admin_allowed(ip):
                logger.warning('Django admin refused for %s (not in ADMIN_ALLOWED_IPS)', ip)
                raise Http404()
        return self.get_response(request)
