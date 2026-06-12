import threading

_req_local = threading.local()


def set_current_request(request):
    _req_local.request = request


def get_current_request():
    return getattr(_req_local, 'request', None)


class RequestMiddleware:
    """Middleware that stores the current request in thread-local storage.

    Signals and other background helpers can call `get_current_request()` to
    enrich audit records with IP and user-agent.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_current_request(request)
        try:
            return self.get_response(request)
        finally:
            # Clean up to avoid leaking requests between threads
            set_current_request(None)
