"""An append-only index of decentralized identifiers (DIDs) and their controllers."""

import re

DID_RE = re.compile(r"^did:[a-z0-9]+:[A-Za-z0-9._:%-]+$")


class IndexError_(Exception):
    pass


class IdentityIndexer:
    def __init__(self):
        self._controllers = {}
        self._history = []

    def register(self, did, controller):
        if not DID_RE.match(did):
            raise IndexError_("malformed DID")
        if did in self._controllers:
            raise IndexError_("DID already registered")
        self._controllers[did] = controller
        self._history.append(("register", did, controller))

    def rotate(self, did, current, new_controller):
        if self._controllers.get(did) != current:
            raise IndexError_("not the current controller")
        self._controllers[did] = new_controller
        self._history.append(("rotate", did, new_controller))

    def resolve(self, did):
        if did not in self._controllers:
            raise IndexError_("unknown DID")
        return self._controllers[did]

    def history(self, did):
        return [h for h in self._history if h[1] == did]
