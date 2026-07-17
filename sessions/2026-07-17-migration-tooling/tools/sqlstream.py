"""sqlstream.py — shared streaming SQL-dump parsing (extracted from dump-census.py, same logic
that validated against 8 known counts on 2026-07-17)."""
import re

def parse_tuples(stmt):
    """Yield value tuples from an INSERT statement (backslash-escaped strings, embedded newlines)."""
    i = stmt.find('VALUES')
    if i < 0:
        return
    i += 6
    n = len(stmt)
    while i < n:
        while i < n and stmt[i] in ' \r\n\t,':
            i += 1
        if i >= n or stmt[i] != '(':
            break
        i += 1
        row, buf = [], []
        while i < n:
            c = stmt[i]
            if c in ' \r\n\t' and not buf:
                i += 1
                continue
            if c == "'":
                j = i + 1
                parts = []
                while True:
                    k = stmt.find("'", j)
                    if k < 0:
                        raise ValueError('unterminated string')
                    b = k - 1
                    nb = 0
                    while b >= j and stmt[b] == '\\':
                        nb += 1; b -= 1
                    if nb % 2 == 0:
                        parts.append(stmt[j:k]); i = k + 1; break
                    parts.append(stmt[j:k + 1]); j = k + 1
                s = ''.join(parts)
                s = s.replace('\\\\', '\x00').replace("\\'", "'").replace('\\"', '"') \
                     .replace('\\n', '\n').replace('\\r', '\r').replace('\\0', '\0').replace('\x00', '\\')
                row.append(s)
            elif c == ')':
                if buf:
                    row.append(''.join(buf).strip()); buf = []
                i += 1
                yield row
                break
            elif c == ',':
                if buf:
                    row.append(''.join(buf).strip()); buf = []
                i += 1
            else:
                buf.append(c); i += 1

def columns_from_create(stmt):
    cols = []
    for line in stmt.splitlines():
        m = re.match(r'\s*`(\w+)`\s', line)
        if m:
            cols.append(m.group(1))
    return cols

def statements(fh):
    """Yield complete SQL statements; strips dump comments glued to statement heads."""
    buf = []
    parity = 0
    strip_head = re.compile(r'^(?:\s*(?:#|--)[^\n]*\n|\s*\n)+')
    for line in fh:
        buf.append(line)
        j = 0
        while True:
            k = line.find("'", j)
            if k < 0:
                break
            b = k - 1
            nb = 0
            while b >= 0 and line[b] == '\\':
                nb += 1; b -= 1
            if nb % 2 == 0:
                parity ^= 1
            j = k + 1
    # NOTE: cannot yield inside the char loop above; do per-line check
        if parity == 0 and line.rstrip().endswith(';'):
            yield strip_head.sub('', ''.join(buf))
            buf = []
    if buf:
        yield strip_head.sub('', ''.join(buf))
