"""Tiny DOM over html.parser (stdlib) for the one-off Webflow content import."""
from html.parser import HTMLParser
import html as htmllib
import re

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs=None, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs or []), parent, []

    @property
    def classes(self):
        return (self.attrs.get("class") or "").split()

    def text(self):
        parts = []
        for c in self.children:
            parts.append(c if isinstance(c, str) else c.text())
        return re.sub(r"\s+", " ", htmllib.unescape(" ".join(parts))).replace("‍", "").strip()

    def find_all(self, pred):
        out = []
        for c in self.children:
            if isinstance(c, Node):
                if pred(c):
                    out.append(c)
                out.extend(c.find_all(pred))
        return out

    def find(self, pred):
        r = self.find_all(pred)
        return r[0] if r else None

    def by_class(self, cls):
        return self.find_all(lambda n: cls in n.classes)

    def by_tag(self, *tags):
        return self.find_all(lambda n: n.tag in tags)


class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not self.root and n.tag != tag:
            n = n.parent
        if n is not self.root:
            self.cur = n.parent

    def handle_data(self, data):
        if self.cur.tag not in ("script", "style"):
            self.cur.children.append(data)


def parse(source):
    b = Builder()
    b.feed(source)
    return b.root
