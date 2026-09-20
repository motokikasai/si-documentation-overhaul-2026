"""Stream a mysqldump and yield rows of chosen tables as tuples of python values."""
import io, sys

def _unescape(s):
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == '\\':
            i += 1
            if i >= len(s):
                break
            d = s[i]
            out.append({'0':'\0','n':'\n','r':'\r','t':'\t','b':'\b','Z':'\x1a',
                        '\\':'\\',"'":"'",'"':'"','%':'\\%','_':'\\_'}.get(d, d))
        else:
            out.append(c)
        i += 1
    return ''.join(out)

def parse_values(body):
    """body = the text after VALUES, ending before the final ';'. Yields tuples."""
    rows = []
    i, n = 0, len(body)
    while i < n:
        if body[i] != '(':
            i += 1
            continue
        i += 1
        row, cur, in_str = [], [], False
        while i < n:
            c = body[i]
            if in_str:
                if c == '\\':
                    cur.append(c)
                    i += 1
                    if i < n:
                        cur.append(body[i])
                    i += 1
                    continue
                if c == "'":
                    in_str = False
                    i += 1
                    continue
                cur.append(c)
                i += 1
                continue
            if c == "'":
                in_str = True
                cur.append('\x00STR')
                i += 1
                continue
            if c == ',':
                row.append(''.join(cur))
                cur = []
                i += 1
                continue
            if c == ')':
                row.append(''.join(cur))
                i += 1
                break
            cur.append(c)
            i += 1
        out = []
        for f in row:
            f = f.strip()
            if f.startswith('\x00STR'):
                out.append(_unescape(f[4:]))
            elif f == 'NULL':
                out.append(None)
            else:
                out.append(f)
        rows.append(tuple(out))
    return rows

def stream(path, table, encoding='utf-8'):
    prefix = "INSERT INTO `%s` VALUES" % table
    buf = None
    with io.open(path, 'r', encoding=encoding, errors='replace') as fh:
        for line in fh:
            if buf is None:
                if line.startswith(prefix):
                    buf = [line[len(prefix):]]
                    if line.rstrip().endswith(';'):
                        stmt = ''.join(buf).rstrip()
                        yield from parse_values(stmt[:-1])
                        buf = None
                continue
            buf.append(line)
            if line.rstrip().endswith(';'):
                stmt = ''.join(buf).rstrip()
                yield from parse_values(stmt[:-1])
                buf = None


def stream_many(path, tables, encoding='utf-8'):
    """Several tables in ONE pass over the dump. Yields (table, row_tuple)."""
    prefixes = {t: "INSERT INTO `%s` VALUES" % t for t in tables}
    cur_table, buf = None, None
    with io.open(path, 'r', encoding=encoding, errors='replace') as fh:
        for line in fh:
            if buf is None:
                if not line.startswith('INSERT INTO `'):
                    continue
                for t, p in prefixes.items():
                    if line.startswith(p):
                        cur_table, buf = t, [line[len(p):]]
                        break
                else:
                    continue
                if line.rstrip().endswith(';'):
                    for r in parse_values(''.join(buf).rstrip()[:-1]):
                        yield cur_table, r
                    buf = None
                continue
            buf.append(line)
            if line.rstrip().endswith(';'):
                for r in parse_values(''.join(buf).rstrip()[:-1]):
                    yield cur_table, r
                buf = None
