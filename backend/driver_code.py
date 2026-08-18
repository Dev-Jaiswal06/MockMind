# backend/driver_code.py — Language-specific driver code generator
import re
import json
import logging

logger = logging.getLogger("driver_code")


# ══════════════════════════════════
# 1. DETECT FUNCTION NAME
# ══════════════════════════════════

def detect_function_name(code, language):
    """Extract the user's function/method name from their code."""
    if language == "python":
        m = re.search(r'def\s+(\w+)\s*\(', code)
        name = m.group(1) if m else "solution"
        logger.info(f"Detected Python function: {name}")
        return name

    elif language == "java":
        matches = re.findall(
            r'public\s+[\w<>\[\],\s]+\s+(\w+)\s*\(', code
        )
        for name in matches:
            if name not in ("main", "Solution", "Main"):
                logger.info(f"Detected Java method: {name}")
                return name
        logger.info("Java: no method found, defaulting to 'solution'")
        return "solution"

    elif language in ("cpp", "c"):
        patterns = [
            r'(?:(?:vector|list|string|set|map|pair|int|long|long\s+long|float|double|bool|char|void|auto)\s*(?:<[^>]+>)?\s*(?:&|\*)?\s+)(\w+)\s*\(',
        ]
        for pat in patterns:
            m = re.search(pat, code)
            if m and m.group(1) != "main":
                logger.info(f"Detected C/C++ function: {m.group(1)}")
                return m.group(1)
        logger.info("C/C++: no function found, defaulting to 'solution'")
        return "solution"

    return "solution"


def _count_params(code, language):
    """Count the number of parameters in the user's function signature."""
    func_name = detect_function_name(code, language)
    if language == "python":
        m = re.search(r'def\s+' + func_name + r'\s*\(([^)]*)\)', code)
        if m:
            params = [p.strip() for p in m.group(1).split(',') if p.strip() and p.strip() != 'self']
            return len(params)
    elif language == "java":
        m = re.search(r'public\s+[\w<>\[\],\s]+\s+' + func_name + r'\s*\(([^)]*)\)', code)
        if m:
            params = [p.strip() for p in m.group(1).split(',') if p.strip()]
            return len(params)
    elif language in ("cpp", "c"):
        m = re.search(func_name + r'\s*\(([^)]*)\)', code)
        if m:
            params = [p.strip() for p in m.group(1).split(',') if p.strip()]
            return len(params)
    return 2  # default to 2 params



# ══════════════════════════════════
# 2. OUTPUT NORMALIZATION
# ══════════════════════════════════

def normalize_output(text):
    """Normalize output text for comparison."""
    if text is None:
        return ""
    text = text.strip()
    if not text:
        return ""

    # Convert Python booleans
    text = re.sub(r'\bTrue\b', 'true', text)
    text = re.sub(r'\bFalse\b', 'false', text)
    text = re.sub(r'\bNone\b', 'null', text)

    # Try JSON parse for deep normalization
    try:
        obj = json.loads(text)
        return json.dumps(obj, separators=(',', ':'), ensure_ascii=False)
    except (json.JSONDecodeError, ValueError):
        pass

    # Try converting Python list repr to JSON
    converted = text.replace("'", '"')
    try:
        obj = json.loads(converted)
        return json.dumps(obj, separators=(',', ':'), ensure_ascii=False)
    except (json.JSONDecodeError, ValueError):
        pass

    return " ".join(text.split())


def compare_outputs(actual, expected):
    return normalize_output(actual) == normalize_output(expected)


# ══════════════════════════════════
# 3. MAIN ENTRY POINTS
# ══════════════════════════════════

def wrap_with_driver(code, language, stdin_data=""):
    """Wrap user code with execution driver for Submit (test case) mode."""
    func_name = detect_function_name(code, language)
    logger.info(f"wrap_with_driver: lang={language}, func={func_name}")

    if language == "python":
        return _python_driver(code, func_name)
    elif language == "java":
        return _java_driver(code, func_name)
    elif language == "cpp":
        return _cpp_driver(code, func_name)
    elif language == "c":
        return _c_driver(code, func_name)
    return code


def wrap_with_driver_for_run(code, language):
    """Wrap for single Run — executes user code directly."""
    func_name = detect_function_name(code, language)
    logger.info(f"wrap_with_driver_for_run: lang={language}, func={func_name}")

    if language == "python":
        return _python_run_driver(code)
    elif language == "java":
        return _java_driver(code, func_name)
    elif language == "cpp":
        return _cpp_driver(code, func_name)
    elif language == "c":
        return _c_driver(code, func_name)
    return code


# ══════════════════════════════════
# 4. PYTHON DRIVER
# ══════════════════════════════════

def _python_driver(user_code, func_name):
    return f'''import sys, json

{user_code}

if __name__ == "__main__":
    try:
        _stdin = sys.stdin.read().strip()
        if _stdin:
            _lines = _stdin.split("\\n")
            _args = []
            for _line in _lines:
                _line = _line.strip()
                if not _line:
                    continue
                try:
                    _val = json.loads(_line.replace("'", '"'))
                except (json.JSONDecodeError, ValueError):
                    _val = _line.strip("'").strip('"')
                _args.append(_val)
            _result = {func_name}(*_args)
        else:
            _result = {func_name}()
        if _result is None:
            sys.exit(0)
        if isinstance(_result, str):
            print(_result)
        else:
            print(json.dumps(_result, separators=(",", ":"), ensure_ascii=False))
    except SystemExit:
        raise
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
'''


# ════════════════════════════════
# 4b. PYTHON RUN DRIVER
# ════════════════════════════════

def _python_run_driver(user_code):
    """Minimal wrapper for Run mode — executes user code directly.
    If stdin is provided, tries to call the user's function with parsed args.
    If no stdin, just runs the code as-is (print, errors, etc.)."""
    return f'''import sys, json

{user_code}

if __name__ == "__main__":
    try:
        _stdin = sys.stdin.read().strip()
        if _stdin:
            _lines = _stdin.split("\\n")
            _args = []
            for _line in _lines:
                _line = _line.strip()
                if not _line:
                    continue
                try:
                    _val = json.loads(_line.replace("'", '"'))
                except (json.JSONDecodeError, ValueError):
                    _val = _line.strip("'").strip('"')
                _args.append(_val)
            _func = globals().get("solution")
            if _func is not None:
                _result = _func(*_args)
                if _result is not None:
                    if isinstance(_result, str):
                        print(_result)
                    else:
                        print(json.dumps(_result, separators=(",", ":"), ensure_ascii=False))
    except SystemExit:
        raise
    except Exception as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
'''


# ══════════════════════════════════
# 5. JAVA DRIVER (type-aware)
# ══════════════════════════════════

def _parse_java_params(code, func_name):
    """Parse Java method signature. Returns (return_type, [(type, name), ...])."""
    pattern = (
        r'(?:public|private|protected|static|final|synchronized|\s)*\s*'
        r'([\w<>\[\],\s]+?)\s+'
        + re.escape(func_name) +
        r'\s*\('
    )
    m = re.search(pattern, code)
    if not m:
        logger.warning(f"Java: could not find {func_name}(...) in code")
        return 'Object', []

    return_type = m.group(1).strip()
    for q in ('public', 'private', 'protected', 'static', 'final', 'synchronized'):
        return_type = re.sub(rf'\b{q}\b', '', return_type).strip()

    paren_start = code.index('(', m.start())
    depth, pos = 1, paren_start + 1
    while pos < len(code) and depth > 0:
        if code[pos] == '(':  depth += 1
        elif code[pos] == ')': depth -= 1
        pos += 1
    params_str = code[paren_start + 1:pos - 1].strip()

    if not params_str:
        return return_type, []

    params, current, depth = [], '', 0
    for ch in params_str:
        if ch == '<':  depth += 1; current += ch
        elif ch == '>': depth -= 1; current += ch
        elif ch == ',' and depth == 0:
            params.append(current.strip()); current = ''
        else: current += ch
    if current.strip():
        params.append(current.strip())

    parsed = []
    for p in params:
        p = p.strip()
        if not p:
            continue
        parts = p.rsplit(None, 1)
        if len(parts) == 2:
            ptype = parts[0].strip()
            pname = parts[1].strip().split('=')[0].strip()
            parsed.append((ptype, pname))

    logger.info(f"Java signature: {return_type} {func_name}({parsed})")
    return return_type, parsed


def _java_classify_type(t):
    """Classify a Java type into a canonical category."""
    t = t.strip()
    if t == 'void':                      return 'void'
    if t == 'String':                    return 'string'
    if t in ('int',):                    return 'int'
    if t in ('long',):                   return 'long'
    if t in ('double', 'float'):         return 'double'
    if t in ('boolean',):                return 'bool'
    if t in ('char',):                   return 'char'
    if t == 'int[]':                     return 'int_array'
    if t == 'long[]':                    return 'long_array'
    if t in ('double[]', 'float[]'):     return 'double_array'
    if t == 'String[]':                  return 'string_array'
    if t == 'char[]':                    return 'char_array'
    if re.match(r'ArrayList\s*<\s*Integer\s*>', t):  return 'int_list'
    if re.match(r'ArrayList\s*<\s*Long\s*>', t):     return 'long_list'
    if re.match(r'ArrayList\s*<\s*Double\s*>', t):   return 'double_list'
    if re.match(r'ArrayList\s*<\s*String\s*>', t):   return 'string_list'
    if re.match(r'List\s*<\s*Integer\s*>', t):       return 'int_list'
    if re.match(r'List\s*<\s*Long\s*>', t):          return 'long_list'
    if re.match(r'List\s*<\s*Double\s*>', t):        return 'double_list'
    if re.match(r'List\s*<\s*String\s*>', t):        return 'string_list'
    if t == 'int[][]':                               return 'int_matrix'
    if t == 'char[][]':                              return 'char_matrix'
    if t == 'String[][]':                            return 'string_matrix'
    if re.match(r'(?:ArrayList|List)\s*<\s*(?:ArrayList|List)\s*<\s*Integer\s*>\s*>', t): return 'list_list_int'
    if re.match(r'(?:ArrayList|List)\s*<\s*(?:ArrayList|List)\s*<\s*String\s*>\s*>', t):  return 'list_list_str'
    return 'unknown'


def _java_strip_boilerplate(code):
    """Remove package/import declarations from user Java code, keep class/method."""
    lines = code.split('\n')
    result = []
    for line in lines:
        if re.match(r'\s*package\s+', line):
            continue
        if re.match(r'\s*import\s+', line):
            continue
        result.append(line)
    return '\n'.join(result).strip()


def _java_typed_main(func_name, params, return_type, class_name):
    """Generate type-aware main() for Java."""
    n = len(params)
    deser = []
    for i, (ptype, pname) in enumerate(params):
        cat = _java_classify_type(ptype)
        v = f'_a{i}'
        src = f'_lines[{i}]'
        if cat == 'string':
            deser.append(f'        String {v} = {src};')
        elif cat == 'int':
            deser.append(f'        int {v} = Integer.parseInt({src}.trim());')
        elif cat == 'long':
            deser.append(f'        long {v} = Long.parseLong({src}.trim());')
        elif cat == 'double':
            deser.append(f'        double {v} = Double.parseDouble({src}.trim());')
        elif cat == 'bool':
            deser.append(f'        boolean {v} = {src}.trim().equals("true");')
        elif cat == 'char':
            deser.append(f'        char {v} = {src}.trim().charAt(0);')
        elif cat == 'int_array':
            deser.append(f'        int[] {v} = _parseIntArray({src});')
        elif cat == 'long_array':
            deser.append(f'        long[] {v} = _parseLongArray({src});')
        elif cat == 'double_array':
            deser.append(f'        double[] {v} = _parseDoubleArray({src});')
        elif cat == 'string_array':
            deser.append(f'        String[] {v} = _parseStringArray({src});')
        elif cat == 'int_list':
            deser.append(f'        ArrayList<Integer> {v} = _parseIntList({src});')
        elif cat == 'string_list':
            deser.append(f'        ArrayList<String> {v} = _parseStringList({src});')
        elif cat == 'int_matrix':
            deser.append(f'        int[][] {v} = _parseIntMatrix({src});')
        elif cat == 'char_matrix':
            deser.append(f'        char[][] {v} = _parseCharMatrix({src});')
        elif cat == 'string_matrix':
            deser.append(f'        String[][] {v} = _parseStrMatrix({src});')
        elif cat == 'list_list_int':
            deser.append(f'        ArrayList<ArrayList<Integer>> {v} = _parseListListInt({src});')
        elif cat == 'list_list_str':
            deser.append(f'        ArrayList<ArrayList<String>> {v} = _parseListListStr({src});')
        else:
            deser.append(f'        String {v} = {src};')

    args = ', '.join(f'_a{i}' for i in range(n))
    min_check = '' if n == 0 else f'\n        if (_lines.length < {n}) return;'

    ret_cat = _java_classify_type(return_type)
    if ret_cat == 'void':
        body = f'        obj.{func_name}({args});'
    elif ret_cat == 'string':
        body = f'        System.out.println(obj.{func_name}({args}));'
    elif ret_cat in ('int', 'long', 'double', 'bool', 'char'):
        body = f'        System.out.println(obj.{func_name}({args}));'
    elif ret_cat == 'int_array':
        body = f'        System.out.println(_serialize(obj.{func_name}({args})));'
    elif ret_cat == 'long_array':
        body = f'        System.out.println(_serialize(obj.{func_name}({args})));'
    elif ret_cat == 'double_array':
        body = f'        System.out.println(_serialize(obj.{func_name}({args})));'
    elif ret_cat == 'string_array':
        body = f'        System.out.println(_serialize(obj.{func_name}({args})));'
    elif ret_cat == 'int_list':
        body = f'        System.out.println(_serialize(obj.{func_name}({args})));'
    elif ret_cat == 'string_list':
        body = f'        System.out.println(_serialize(obj.{func_name}({args})));'
    elif ret_cat in ('int_matrix', 'char_matrix', 'string_matrix', 'list_list_int', 'list_list_str'):
        body = f'        System.out.println(_serialize(obj.{func_name}({args})));'
    else:
        body = f'        System.out.println(obj.{func_name}({args}));'

    deser_block = '\n'.join(deser)

    return f'''    public static void main(String[] args) {{
        Scanner _sc = new Scanner(System.in);
        StringBuilder _sb = new StringBuilder();
        while (_sc.hasNextLine()) {{
            String _line = _sc.nextLine().trim();
            if (!_line.isEmpty()) {{
                if (_sb.length() > 0) _sb.append("\\n");
                _sb.append(_line);
            }}
        }}
        _sc.close();
        String[] _lines = _sb.toString().split("\\n");
        if (_lines.length == 0) return;{min_check}
        try {{
{deser_block}
            {class_name} obj = new {class_name}();
{body}
        }} catch (Exception e) {{
            System.err.println(e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }}
    }}'''


def _java_helpers():
    """Generate Java helper methods for deserialization/serialization.
    
    Uses (char)34 for double-quote to avoid all quote escaping issues.
    """
    QT = "(char)34"
    return ('    private static int[] _parseIntArray(String s) {\n'
        '        s = s.trim();\n'
        '        if (s.startsWith("[")) s = s.substring(1, s.length() - 1);\n'
        '        if (s.isEmpty()) return new int[0];\n'
        '        String[] parts = s.split(",");\n'
        '        int[] arr = new int[parts.length];\n'
        '        for (int i = 0; i < parts.length; i++) arr[i] = Integer.parseInt(parts[i].trim());\n'
        '        return arr;\n'
        '    }\n'
        '\n'
        '    private static long[] _parseLongArray(String s) {\n'
        '        s = s.trim();\n'
        '        if (s.startsWith("[")) s = s.substring(1, s.length() - 1);\n'
        '        if (s.isEmpty()) return new long[0];\n'
        '        String[] parts = s.split(",");\n'
        '        long[] arr = new long[parts.length];\n'
        '        for (int i = 0; i < parts.length; i++) arr[i] = Long.parseLong(parts[i].trim());\n'
        '        return arr;\n'
        '    }\n'
        '\n'
        '    private static double[] _parseDoubleArray(String s) {\n'
        '        s = s.trim();\n'
        '        if (s.startsWith("[")) s = s.substring(1, s.length() - 1);\n'
        '        if (s.isEmpty()) return new double[0];\n'
        '        String[] parts = s.split(",");\n'
        '        double[] arr = new double[parts.length];\n'
        '        for (int i = 0; i < parts.length; i++) arr[i] = Double.parseDouble(parts[i].trim());\n'
        '        return arr;\n'
        '    }\n'
        '\n'
        '    private static String[] _parseStringArray(String s) {\n'
        '        s = s.trim();\n'
        '        if (s.startsWith("[")) s = s.substring(1, s.length() - 1);\n'
        '        if (s.endsWith("]")) s = s.substring(0, s.length() - 1);\n'
        '        if (s.isEmpty()) return new String[0];\n'
        '        String[] raw = s.split(",");\n'
        '        String[] arr = new String[raw.length];\n'
        '        for (int i = 0; i < raw.length; i++) {\n'
        '            String t = raw[i].trim();\n'
        '            if (t.length() >= 2 && t.charAt(0) == ' + QT + ' && t.charAt(t.length()-1) == ' + QT + ') t = t.substring(1, t.length() - 1);\n'
        '            arr[i] = t;\n'
        '        }\n'
        '        return arr;\n'
        '    }\n'
        '\n'
        '    private static ArrayList<Integer> _parseIntList(String s) {\n'
        '        ArrayList<Integer> list = new ArrayList<>();\n'
        '        s = s.trim();\n'
        '        if (s.startsWith("[")) s = s.substring(1, s.length() - 1);\n'
        '        if (s.isEmpty()) return list;\n'
        '        String[] parts = s.split(",");\n'
        '        for (String p : parts) list.add(Integer.parseInt(p.trim()));\n'
        '        return list;\n'
        '    }\n'
        '\n'
        '    private static ArrayList<String> _parseStringList(String s) {\n'
        '        ArrayList<String> list = new ArrayList<>();\n'
        '        s = s.trim();\n'
        '        if (s.startsWith("[")) s = s.substring(1, s.length() - 1);\n'
        '        if (s.endsWith("]")) s = s.substring(0, s.length() - 1);\n'
        '        if (s.isEmpty()) return list;\n'
        '        String[] raw = s.split(",");\n'
        '        for (String p : raw) {\n'
        '            String t = p.trim();\n'
        '            if (t.length() >= 2 && t.charAt(0) == ' + QT + ' && t.charAt(t.length()-1) == ' + QT + ') t = t.substring(1, t.length() - 1);\n'
        '            list.add(t);\n'
        '        }\n'
        '        return list;\n'
        '    }\n'
        '\n'
        '    private static int[][] _parseIntMatrix(String s) {\n'
'        s = s.trim();\n'
'        if (s.length() < 2 || s.charAt(0) != \'[\') return new int[0][];\n'
'        String inner = s.substring(1, s.length() - 1);\n'
'        ArrayList<int[]> rows = new ArrayList<>();\n'
'        int depth = 0; StringBuilder cur = new StringBuilder();\n'
'        for (int i = 0; i < inner.length(); i++) {\n'
'            char c = inner.charAt(i);\n'
'            if (c == \'[\') depth++;\n'
'            else if (c == \']\') depth--;\n'
'            if (c == \',\' && depth == 0) { rows.add(_parseIntArray(cur.toString())); cur.setLength(0); }\n'
'            else cur.append(c);\n'
'        }\n'
'        if (cur.length() > 0) rows.add(_parseIntArray(cur.toString()));\n'
'        return rows.toArray(new int[0][]);\n'
'    }\n'
'\n'
'    private static char[][] _parseCharMatrix(String s) {\n'
'        String[] rows = _parseStringArray(s);\n'
'        char[][] m = new char[rows.length][];\n'
'        for (int i = 0; i < rows.length; i++) m[i] = rows[i].toCharArray();\n'
'        return m;\n'
'    }\n'
'\n'
'    private static String[][] _parseStrMatrix(String s) {\n'
'        s = s.trim();\n'
'        if (s.length() < 2 || s.charAt(0) != \'[\') return new String[0][];\n'
'        String inner = s.substring(1, s.length() - 1);\n'
'        ArrayList<String[]> rows = new ArrayList<>();\n'
'        int depth = 0; StringBuilder cur = new StringBuilder();\n'
'        for (int i = 0; i < inner.length(); i++) {\n'
'            char c = inner.charAt(i);\n'
'            if (c == \'[\') depth++;\n'
'            else if (c == \']\') depth--;\n'
'            if (c == \',\' && depth == 0) { rows.add(_parseStringArray(cur.toString())); cur.setLength(0); }\n'
'            else cur.append(c);\n'
'        }\n'
'        if (cur.length() > 0) rows.add(_parseStringArray(cur.toString()));\n'
'        return rows.toArray(new String[0][]);\n'
'    }\n'
'\n'
'    private static ArrayList<ArrayList<Integer>> _parseListListInt(String s) {\n'
'        s = s.trim();\n'
'        ArrayList<ArrayList<Integer>> res = new ArrayList<>();\n'
'        if (s.length() < 2 || s.charAt(0) != \'[\') return res;\n'
'        String inner = s.substring(1, s.length() - 1);\n'
'        int depth = 0; StringBuilder cur = new StringBuilder();\n'
'        for (int i = 0; i < inner.length(); i++) {\n'
'            char c = inner.charAt(i);\n'
'            if (c == \'[\') depth++;\n'
'            else if (c == \']\') depth--;\n'
'            if (c == \',\' && depth == 0) { res.add(_parseIntList(cur.toString())); cur.setLength(0); }\n'
'            else cur.append(c);\n'
'        }\n'
'        if (cur.length() > 0) res.add(_parseIntList(cur.toString()));\n'
'        return res;\n'
'    }\n'
'\n'
'    private static ArrayList<ArrayList<String>> _parseListListStr(String s) {\n'
'        s = s.trim();\n'
'        ArrayList<ArrayList<String>> res = new ArrayList<>();\n'
'        if (s.length() < 2 || s.charAt(0) != \'[\') return res;\n'
'        String inner = s.substring(1, s.length() - 1);\n'
'        int depth = 0; StringBuilder cur = new StringBuilder();\n'
'        for (int i = 0; i < inner.length(); i++) {\n'
'            char c = inner.charAt(i);\n'
'            if (c == \'[\') depth++;\n'
'            else if (c == \']\') depth--;\n'
'            if (c == \',\' && depth == 0) { res.add(_parseStringList(cur.toString())); cur.setLength(0); }\n'
'            else cur.append(c);\n'
'        }\n'
'        if (cur.length() > 0) res.add(_parseStringList(cur.toString()));\n'
'        return res;\n'
'    }\n'
'\n'
'    private static String _serialize(int[][] m) {\n'
'        StringBuilder sb = new StringBuilder("[");\n'
'        for (int i = 0; i < m.length; i++) { if (i > 0) sb.append(","); sb.append(_serialize(m[i])); }\n'
'        return sb.append("]").toString();\n'
'    }\n'
'\n'
'    private static String _serialize(char[][] m) {\n'
'        StringBuilder sb = new StringBuilder("[");\n'
'        for (int i = 0; i < m.length; i++) {\n'
'            if (i > 0) sb.append(",");\n'
'            sb.append(String.valueOf(' + QT + ')).append(new String(m[i])).append(String.valueOf(' + QT + '));\n'
'        }\n'
'        return sb.append("]").toString();\n'
'    }\n'
'\n'
'    private static String _serialize(String[][] m) {\n'
'        StringBuilder sb = new StringBuilder("[");\n'
'        for (int i = 0; i < m.length; i++) {\n'
'            if (i > 0) sb.append(",");\n'
'            sb.append(_serialize(m[i]));\n'
'        }\n'
'        return sb.append("]").toString();\n'
'    }\n'
'\n'
'    private static String _serialize(int[] arr) {\n'
        '        StringBuilder sb = new StringBuilder("[");\n'
        '        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(arr[i]); }\n'
        '        return sb.append("]").toString();\n'
        '    }\n'
        '\n'
        '    private static String _serialize(long[] arr) {\n'
        '        StringBuilder sb = new StringBuilder("[");\n'
        '        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(arr[i]); }\n'
        '        return sb.append("]").toString();\n'
        '    }\n'
        '\n'
        '    private static String _serialize(double[] arr) {\n'
        '        StringBuilder sb = new StringBuilder("[");\n'
        '        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(arr[i]); }\n'
        '        return sb.append("]").toString();\n'
        '    }\n'
        '\n'
        '    private static String _serialize(String[] arr) {\n'
        '        StringBuilder sb = new StringBuilder("[");\n'
        '        for (int i = 0; i < arr.length; i++) { if (i > 0) sb.append(","); sb.append(String.valueOf(' + QT + ')).append(arr[i]).append(String.valueOf(' + QT + ')); }\n'
        '        return sb.append("]").toString();\n'
        '    }\n'
        '\n'
'    private static String _serialize(List<?> list) {\n'
'        StringBuilder sb = new StringBuilder("[");\n'
'        for (int i = 0; i < list.size(); i++) {\n'
'            if (i > 0) sb.append(",");\n'
'            Object o = list.get(i);\n'
'            if (o instanceof String) sb.append(String.valueOf(' + QT + ')).append(o).append(String.valueOf(' + QT + '));\n'
'            else if (o instanceof List) sb.append(_serialize((List<?>) o));\n'
'            else sb.append(o);\n'
'        }\n'
'        return sb.append("]").toString();\n'
'    }\n')


def _java_driver(user_code, func_name):
    """Generate complete Java driver with type-aware deserialization."""
    return_type, params = _parse_java_params(user_code, func_name)
    clean = _java_strip_boilerplate(user_code)

    has_class = bool(re.search(r'\bclass\s+\w+', clean))
    if has_class:
        m = re.search(r'\bclass\s+(\w+)', clean)
        class_name = m.group(1) if m else 'Solution'
        clean = re.sub(r'\bpublic\s+class\b', 'class', clean)
        clean = re.sub(r'\bstatic\s+class\b', 'class', clean)
        clean = re.sub(r'\bclass\s+', 'static class ', clean)
    else:
        class_name = 'Solution'
        clean = f'static class Solution {{\n{clean}\n}}'

    main_body = _java_typed_main(func_name, params, return_type, class_name)
    helpers = _java_helpers()

    return f'''import java.util.*;
import java.io.*;

public class Main {{

{clean}

{helpers}

{main_body}
}}
'''


# ══════════════════════════════════
# 6. C++ DRIVER (C++11, type-aware)
# ══════════════════════════════════

def _cpp_classify_type(t):
    """Classify a C++ type for serialization/deserialization."""
    base = t.strip().replace('const ', '').replace('&', '').replace('*', '').strip()
    if base in ('string', 'std::string'):
        return 'string'
    if base in ('int', 'short', 'char', 'unsigned int', 'unsigned'):
        return 'int'
    if base in ('long long', 'long'):
        return 'long'
    if base in ('double', 'float'):
        return 'double'
    if base == 'bool':
        return 'bool'
    if base == 'void':
        return 'void'
    m = re.match(r'vector\s*<\s*(.+)\s*>', base)
    if m:
        inner = m.group(1).strip()
        if inner in ('int', 'long', 'long long'):
            return 'vector<int>'
        if inner == 'string':
            return 'vector<string>'
        if inner.startswith('vector'):
            inner_m = re.match(r'vector\s*<\s*(.+)\s*>$', inner)
            inner_inner = inner_m.group(1).strip() if inner_m else inner
            if inner_inner in ('int', 'long', 'long long'):
                return 'vector<vector<int>>'
            if inner_inner == 'char':
                return 'vector<vector<char>>'
            if inner_inner == 'string':
                return 'vector<vector<string>>'
    return 'unknown'


def _strip_cpp_boilerplate(code):
    """Remove #include, using namespace, and int main(){...} from user C++ code."""
    lines = code.split('\n')
    result = []
    in_main = False
    brace_depth = 0
    for line in lines:
        if re.match(r'\s*#include\b', line):
            continue
        if re.match(r'\s*using\s+namespace\s+', line):
            continue
        if not in_main and re.match(r'\s*(?:int\s+)?main\s*\s*\(', line):
            in_main = True
            brace_depth = line.count('{') - line.count('}')
            continue
        if in_main:
            brace_depth += line.count('{') - line.count('}')
            if brace_depth <= 0:
                in_main = False
            continue
        result.append(line)
    return '\n'.join(result).strip()


def _parse_cpp_params(code, func_name):
    """Parse C++ function signature. Returns (return_type, [(type, name), ...])."""
    pattern = re.escape(func_name) + r'\s*\('
    m = re.search(pattern, code)
    if not m:
        logger.warning(f"C++: could not find {func_name}(...) in code")
        return 'int', []

    paren_start = code.index('(', m.start())
    depth, pos = 1, paren_start + 1
    while pos < len(code) and depth > 0:
        if code[pos] == '(':
            depth += 1
        elif code[pos] == ')':
            depth -= 1
        pos += 1
    params_str = code[paren_start + 1:pos - 1].strip()

    before = code[:m.start()]
    line_start = before.rfind('\n')
    sig_prefix = before[line_start + 1:].strip() if line_start >= 0 else before.strip()
    for q in ('virtual', 'static', 'inline'):
        sig_prefix = re.sub(rf'\b{q}\b', '', sig_prefix).strip()
    return_type = sig_prefix if sig_prefix else 'int'

    if not params_str:
        return return_type, []
    params, current, depth = [], '', 0
    for ch in params_str:
        if ch in '<(':
            depth += 1
            current += ch
        elif ch in '>)':
            depth -= 1
            current += ch
        elif ch == ',' and depth == 0:
            params.append(current.strip())
            current = ''
        else:
            current += ch
    if current.strip():
        params.append(current.strip())

    parsed = []
    for p in params:
        p = p.strip()
        if not p:
            continue
        parts = p.rsplit(None, 1)
        if len(parts) == 2:
            ptype = parts[0].strip()
            pname = parts[1].strip().split('=')[0].strip()
            parsed.append((ptype, pname))

    logger.info(f"C++ signature: {return_type} {func_name}({parsed})")
    return return_type, parsed


def _cpp_typed_main(func_name, params, return_type):
    """Generate a type-aware main() for C++."""
    n = len(params)
    deser = []
    for i, (ptype, pname) in enumerate(params):
        cat = _cpp_classify_type(ptype)
        v = f'_a{i}'
        src = f'lines[{i}]'
        if cat == 'string':
            deser.append(f'        string {v} = {src};')
        elif cat == 'int':
            deser.append(f'        int {v} = stoi(_trim({src}));')
        elif cat == 'long':
            deser.append(f'        long long {v} = stoll(_trim({src}));')
        elif cat == 'double':
            deser.append(f'        double {v} = stod(_trim({src}));')
        elif cat == 'bool':
            deser.append(f'        bool {v} = (_trim({src}) == "true");')
        elif cat == 'vector<int>':
            deser.append(f'        vector<int> {v} = _parseIntArray({src});')
        elif cat == 'vector<string>':
            deser.append(f'        vector<string> {v} = _parseStringArray({src});')
        elif cat == 'vector<vector<int>>':
            deser.append(f'        vector<vector<int>> {v} = _parseIntArray2D({src});')
        elif cat == 'vector<vector<char>>':
            deser.append(f'        vector<vector<char>> {v} = _parseCharMatrix2D({src});')
        elif cat == 'vector<vector<string>>':
            deser.append(f'        vector<vector<string>> {v} = _parseStrMatrix2D({src});')
        else:
            deser.append(f'        string {v} = _trim({src});')

    args = ', '.join(f'_a{i}' for i in range(n))
    min_check = '' if n == 0 else f'\n    if (lines.size() < {n}) return 0;'

    ret_cat = _cpp_classify_type(return_type)
    if ret_cat == 'void':
        body = f'        {func_name}({args});'
    elif ret_cat == 'bool':
        body = f'        auto _r = {func_name}({args});\n        cout << (_r ? "true" : "false") << endl;'
    elif ret_cat == 'vector<int>':
        body = f'        auto _r = {func_name}({args});\n        cout << _toJson(_r) << endl;'
    elif ret_cat == 'vector<string>':
        body = f'        auto _r = {func_name}({args});\n        cout << _toJsonStr(_r) << endl;'
    elif ret_cat == 'vector<vector<int>>':
        body = f'        auto _r = {func_name}({args});\n        cout << _toJsonVec2D(_r) << endl;'
    elif ret_cat == 'vector<vector<char>>':
        body = f'        auto _r = {func_name}({args});\n        cout << _toJsonCharVec2D(_r) << endl;'
    elif ret_cat == 'vector<vector<string>>':
        body = f'        auto _r = {func_name}({args});\n        cout << _toJsonStrVec2D(_r) << endl;'
    else:
        body = f'        auto _r = {func_name}({args});\n        cout << _r << endl;'

    deser_block = '\n'.join(deser)
    return f'''int main() {{
    vector<string> lines = _readLines();
    if (lines.empty()) return 0;{min_check}
    try {{
{deser_block}
{body}
    }} catch (exception& e) {{
        cerr << e.what() << endl;
        return 1;
    }}
    return 0;
}}'''


def _cpp_driver(user_code, func_name):
    """Generate complete C++ driver with type-aware deserialization."""
    return_type, params = _parse_cpp_params(user_code, func_name)
    clean = _strip_cpp_boilerplate(user_code)
    main_fn = _cpp_typed_main(func_name, params, return_type)

    return f'''#include <bits/stdc++.h>
using namespace std;

{clean}

// ── Judge helpers ──
string _trim(const string& s) {{
    size_t a = s.find_first_not_of(" \\t\\n\\r");
    size_t b = s.find_last_not_of(" \\t\\n\\r");
    return (a == string::npos) ? "" : s.substr(a, b - a + 1);
}}

vector<string> _readLines() {{
    vector<string> v; string s;
    while (getline(cin, s)) {{ s = _trim(s); if (!s.empty()) v.push_back(s); }}
    return v;
}}

vector<int> _parseIntArray(string s) {{
    s = _trim(s); vector<int> r;
    if (s.size() < 2 || s[0] != '[') return r;
    s = s.substr(1, s.size() - 2); string cur;
    for (size_t i = 0; i < s.size(); i++) {{
        if (s[i] == ',') {{ string v = _trim(cur); if (!v.empty()) r.push_back(stoi(v)); cur.clear(); }}
        else cur += s[i];
    }}
    string v = _trim(cur); if (!v.empty()) r.push_back(stoi(v));
    return r;
}}

vector<vector<int>> _parseIntArray2D(string s) {{
    s = _trim(s); vector<vector<int>> r;
    if (s.size() < 2 || s[0] != '[') return r;
    s = s.substr(1, s.size() - 2); int d = 0; string cur;
    for (size_t i = 0; i < s.size(); i++) {{
        if (s[i] == '[') d++; else if (s[i] == ']') d--;
        if (s[i] == ',' && d == 0) {{ string t = _trim(cur); if (!t.empty()) r.push_back(_parseIntArray(t)); cur.clear(); }}
        else cur += s[i];
    }}
    string t = _trim(cur); if (!t.empty()) r.push_back(_parseIntArray(t));
    return r;
}}

vector<string> _parseStringArray(string s) {{
    s = _trim(s); vector<string> r;
    if (s.size() < 2 || s[0] != '[') return r;
    s = s.substr(1, s.size() - 2); string cur; bool inQ = false;
    for (size_t i = 0; i < s.size(); i++) {{
        if (s[i] == '"' && (i == 0 || s[i-1] != '\\\\')) inQ = !inQ;
        else if (s[i] == ',' && !inQ) {{
            string v = _trim(cur);
            if (v.size() >= 2 && v.front() == '"' && v.back() == '"') v = v.substr(1, v.size()-2);
            if (!v.empty()) r.push_back(v); cur.clear();
        }} else cur += s[i];
    }}
    string v = _trim(cur);
    if (v.size() >= 2 && v.front() == '"' && v.back() == '"') v = v.substr(1, v.size()-2);
    if (!v.empty()) r.push_back(v);
    return r;
}}

vector<char> _parseCharArray(string s) {{
    s = _trim(s); vector<char> r;
    if (s.size() >= 2 && s.front() == '"' && s.back() == '"') s = s.substr(1, s.size() - 2);
    for (size_t i = 0; i < s.size(); i++) r.push_back(s[i]);
    return r;
}}

vector<vector<char>> _parseCharMatrix2D(string s) {{
    s = _trim(s); vector<vector<char>> r;
    if (s.size() < 2 || s[0] != '[') return r;
    s = s.substr(1, s.size() - 2); int d = 0; string cur;
    for (size_t i = 0; i < s.size(); i++) {{
        if (s[i] == '[') d++; else if (s[i] == ']') d--;
        if (s[i] == ',' && d == 0) {{ string t = _trim(cur); if (!t.empty()) r.push_back(_parseCharArray(t)); cur.clear(); }}
        else cur += s[i];
    }}
    string t = _trim(cur); if (!t.empty()) r.push_back(_parseCharArray(t));
    return r;
}}

vector<vector<string>> _parseStrMatrix2D(string s) {{
    s = _trim(s); vector<vector<string>> r;
    if (s.size() < 2 || s[0] != '[') return r;
    s = s.substr(1, s.size() - 2); int d = 0; string cur;
    for (size_t i = 0; i < s.size(); i++) {{
        if (s[i] == '[') d++; else if (s[i] == ']') d--;
        if (s[i] == ',' && d == 0) {{ string t = _trim(cur); if (!t.empty()) r.push_back(_parseStringArray(t)); cur.clear(); }}
        else cur += s[i];
    }}
    string t = _trim(cur); if (!t.empty()) r.push_back(_parseStringArray(t));
    return r;
}}

string _toJson(const vector<int>& v) {{
    string r = "["; for (size_t i = 0; i < v.size(); i++) {{ if (i) r += ","; r += to_string(v[i]); }} return r + "]";
}}
string _toJsonVec2D(const vector<vector<int>>& v) {{
    string r = "["; for (size_t i = 0; i < v.size(); i++) {{ if (i) r += ","; r += _toJson(v[i]); }} return r + "]";
}}
string _toJsonStr(const vector<string>& v) {{
    string r = "["; for (size_t i = 0; i < v.size(); i++) {{ if (i) r += ","; r += "\\"" + v[i] + "\\""; }} return r + "]";
}}

string _toJsonStrVec2D(const vector<vector<string>>& v) {{
    string r = "["; for (size_t i = 0; i < v.size(); i++) {{ if (i) r += ","; r += _toJsonStr(v[i]); }} return r + "]";
}}

string _toJsonChars(const vector<char>& v) {{
    string r = "["; for (size_t i = 0; i < v.size(); i++) {{ if (i) r += ","; r += "\\"" + string(1, v[i]) + "\\""; }} return r + "]";
}}

string _toJsonCharVec2D(const vector<vector<char>>& v) {{
    string r = "["; for (size_t i = 0; i < v.size(); i++) {{ if (i) r += ","; r += _toJsonChars(v[i]); }} return r + "]";
}}

{main_fn}
'''


# ══════════════════════════════════
# 7. C DRIVER (type-aware)
# ══════════════════════════════════

def _parse_c_params(code, func_name):
    """Parse C function signature. Returns (return_type, [(type, name), ...])."""
    pattern = (
        r'((?:unsigned\s+)?(?:int|long\s+long|long|short|char|float|double|void|bool)'
        r'(?:\s*\*+)?)\s+'
        + re.escape(func_name) +
        r'\s*\('
    )
    m = re.search(pattern, code)
    if not m:
        logger.warning(f"C: could not find {func_name}(...) in code")
        return 'int', []

    return_type = m.group(1).strip()

    paren_start = code.index('(', m.start())
    depth, pos = 1, paren_start + 1
    while pos < len(code) and depth > 0:
        if code[pos] == '(':  depth += 1
        elif code[pos] == ')': depth -= 1
        pos += 1
    params_str = code[paren_start + 1:pos - 1].strip()

    if not params_str or params_str.strip() == 'void':
        return return_type, []

    params, current, depth = [], '', 0
    for ch in params_str:
        if ch == '(':
            depth += 1; current += ch
        elif ch == ')':
            depth -= 1; current += ch
        elif ch == ',' and depth == 0:
            params.append(current.strip()); current = ''
        else:
            current += ch
    if current.strip():
        params.append(current.strip())

    parsed = []
    for p in params:
        p = p.strip()
        if not p:
            continue
        parts = p.rsplit(None, 1)
        if len(parts) == 2:
            ptype = parts[0].strip()
            pname = parts[1].strip().split('=')[0].strip()
            # Handle C array declarations in the param name: char board[9][9]
            am = re.search(r'(\w+)\s*((?:\[\s*\d*\s*\])+)', pname)
            if am:
                ptype = ptype + am.group(2).replace(' ', '')
                pname = am.group(1)
            parsed.append((ptype, pname))

    logger.info(f"C signature: {return_type} {func_name}({parsed})")
    return return_type, parsed


def _c_classify_type(t):
    t = t.strip()
    if t in ('char*', 'char *', 'const char*', 'const char *'):
        return 'string'
    if t in ('char**', 'char **', 'char*[]', 'char *[]'):
        return 'string_ptr'
    if t in ('char***', 'char ***'):
        return 'string_ptr_ptr'
    if t in ('int', 'short', 'unsigned int', 'unsigned'):
        return 'int'
    if t in ('long long', 'long long int', 'long', 'unsigned long long'):
        return 'long'
    if t in ('double', 'float'):
        return 'double'
    if t in ('bool', '_Bool'):
        return 'bool'
    if t in ('char',):
        return 'char'
    if t in ('int*', 'int *', 'const int*', 'const int *', 'int[]', 'int []'):
        return 'int_ptr'
    if t in ('long long*', 'long long *', 'long*', 'long *'):
        return 'long_ptr'
    if t in ('double*', 'double *', 'float*', 'float *'):
        return 'double_ptr'
    if t in ('int**', 'int **', 'const int**', 'const int **'):
        return 'int_ptr_ptr'
    if t in ('long long**', 'long long **', 'long**', 'long **'):
        return 'long_ptr_ptr'
    if t in ('double**', 'double **', 'float**', 'float **'):
        return 'double_ptr_ptr'
    if re.match(r'char\s*(\[\s*\d+\s*\]){2}', t):
        return 'char_grid'
    return 'unknown'


def _strip_c_boilerplate(code):
    """Remove #include, int main(){} from user C code."""
    lines = code.split('\n')
    result = []
    in_main = False
    brace_depth = 0
    for line in lines:
        if re.match(r'\s*#include\b', line):
            continue
        if not in_main and re.match(r'\s*(?:int\s+)?main\s*\s*\(', line):
            in_main = True
            brace_depth = line.count('{') - line.count('}')
            continue
        if in_main:
            brace_depth += line.count('{') - line.count('}')
            if brace_depth <= 0:
                in_main = False
            continue
        result.append(line)
    return '\n'.join(result).strip()


def _c_is_output_param(pname, ptype):
    """Check if a C parameter is an output-only pointer (returnSize / returnColumnSizes / result / resultSize)."""
    n = (pname or '').lower().strip()
    if '*' not in ptype and '[]' not in ptype:
        return False
    out = ('returnsize', 'return_size', 'returncount', 'return_count',
           'returncolsize', 'returncol', 'return_col_size',
           'returncolsizes', 'return_col_sizes',
           'returncolumnsizes', 'return_column_sizes',
           'resultsize', 'result_size', 'resultcount', 'result_count',
           'result')
    return n in out


_ARRAY_CATS = ('int_ptr', 'long_ptr', 'double_ptr', 'string_ptr',
               'int_ptr_ptr', 'long_ptr_ptr', 'double_ptr_ptr',
               'string_ptr_ptr', 'char_grid')


def _c_is_size_name(name):
    """Names of C array-size params (the int that follows an array)."""
    return bool(re.match(r'^(n|m|n\d+|m\d+|size|len|length)$', name)
                or re.search(r'(size|len)', name))


def _c_analyze_params(params):
    """Classify C params into roles for the driver.

    Returns a list of dicts with: ptype, pname, name, cat, kind
    (input/output), role (data/size/colsize/output), fi (full input index),
    li (line index when sizes are derived away), from (index of the array a
    size/colsize param derives from).
    """
    analyzed = []
    for i, (ptype, pname) in enumerate(params):
        cat = _c_classify_type(ptype)
        name = (pname or '').strip().lower()
        is_out = _c_is_output_param(pname, ptype)
        analyzed.append({'i': i, 'ptype': ptype, 'pname': pname, 'name': name,
                         'cat': cat, 'kind': 'output' if is_out else 'input',
                         'role': None, 'fi': None, 'li': None, 'from': None})

    prev_array = None
    fi = 0
    for a in analyzed:
        if a['kind'] == 'output':
            a['role'] = 'output'
            continue
        a['fi'] = fi
        fi += 1
        if a['cat'] == 'int' and prev_array is not None and _c_is_size_name(a['name']):
            a['role'] = 'size'
            a['from'] = prev_array
        elif a['cat'] == 'int_ptr' and prev_array is not None \
                and 'col' in a['name'] and 'size' in a['name']:
            a['role'] = 'colsize'
            a['from'] = prev_array
        else:
            a['role'] = 'data'
        if a['role'] == 'data':
            if a['cat'] in _ARRAY_CATS:
                prev_array = a['i']
            else:
                prev_array = None

    # line indices: data params compress away size/colsize params in derived mode
    sizes_before = 0
    for a in analyzed:
        if a['kind'] != 'input':
            continue
        if a['role'] in ('size', 'colsize'):
            a['li'] = None
        else:
            a['li'] = a['fi'] - sizes_before
        if a['role'] in ('size', 'colsize'):
            sizes_before += 1
    return analyzed


def _c_typed_main(func_name, params, return_type):
    """Generate type-aware main() for C.

    Handles size params (the `int n` following an array, auto-derived from the
    array length when the test input does not supply a line for it), column-size
    arrays (gridColSize etc.), and string/matrix pointers in both directions.
    """
    analyzed = _c_analyze_params(params)
    input_params = [a for a in analyzed if a['kind'] == 'input']
    output_params = [a for a in analyzed if a['kind'] == 'output']

    full_n = len(input_params)
    min_n = sum(1 for a in input_params if a['role'] == 'data')
    need_full = any(a['role'] in ('size', 'colsize') for a in input_params)

    deser = []
    for a in input_params:
        i, fi, li, cat, role = a['i'], a['fi'], a['li'], a['cat'], a['role']
        v = f'_a{i}'
        if role == 'size':
            frm = a['from']
            if need_full:
                deser.append(f'    int {v} = (_full ? atoi(_trim(_lines[{fi}])) : _a{frm}_n);')
            else:
                deser.append(f'    int {v} = _a{frm}_n;')
            continue
        if role == 'colsize':
            frm = a['from']
            deser.append(f'    int {v}_arr[1000]; int {v}_n = 0;')
            if need_full:
                deser.append(f'    if (_full) {{ char _c[10000]; strncpy(_c, _lines[{fi}], 9999); _c[9999] = \'\\0\'; _parseIntArray(_c, {v}_arr, &{v}_n); }} else {{ for (int _k = 0; _k < _a{frm}_n; _k++) {{ {v}_arr[_k] = _a{frm}_cols; {v}_n++; }} }}')
            else:
                deser.append(f'    for (int _k = 0; _k < _a{frm}_n; _k++) {{ {v}_arr[_k] = _a{frm}_cols; {v}_n++; }}')
            deser.append(f'    int* {v} = {v}_arr;')
            continue

        src = f'(_full ? _lines[{fi}] : _lines[{li}])' if need_full else f'_lines[{li}]'
        if cat == 'string':
            deser.append(f'    char {v}[10000]; strncpy({v}, {src}, 9999); {v}[9999] = \'\\0\';')
        elif cat == 'int':
            deser.append(f'    int {v} = atoi(_trim({src}));')
        elif cat == 'long':
            deser.append(f'    long long {v} = atoll(_trim({src}));')
        elif cat == 'double':
            deser.append(f'    double {v} = atof(_trim({src}));')
        elif cat == 'bool':
            deser.append(f'    int {v} = (strcmp(_trim({src}), "true") == 0);')
        elif cat == 'char':
            deser.append(f'    char {v} = _trim({src})[0];')
        elif cat == 'int_ptr':
            deser.append(f'    int {v}_arr[1000]; int {v}_n = 0; {{ char _c[10000]; strncpy(_c, {src}, 9999); _c[9999] = \'\\0\'; _parseIntArray(_c, {v}_arr, &{v}_n); }}')
            deser.append(f'    int* {v} = {v}_arr;')
        elif cat == 'long_ptr':
            deser.append(f'    long long {v}_arr[1000]; int {v}_n = 0; {{ char _c[10000]; strncpy(_c, {src}, 9999); _c[9999] = \'\\0\'; _parseLongArray(_c, {v}_arr, &{v}_n); }}')
            deser.append(f'    long long* {v} = {v}_arr;')
        elif cat == 'double_ptr':
            deser.append(f'    double {v}_arr[1000]; int {v}_n = 0; {{ char _c[10000]; strncpy(_c, {src}, 9999); _c[9999] = \'\\0\'; _parseDoubleArray(_c, {v}_arr, &{v}_n); }}')
            deser.append(f'    double* {v} = {v}_arr;')
        elif cat == 'string_ptr':
            deser.append(f'    char {v}_arr[1000][256]; int {v}_n = 0; int {v}_cols = 0; char* {v}_ptrs[1000]; {{ char _c[20000]; strncpy(_c, {src}, 19999); _c[19999] = \'\\0\'; _parseStringArray(_c, {v}_arr, 1000, &{v}_n, &{v}_cols); }}')
            deser.append(f'    for (int _k = 0; _k < {v}_n; _k++) {v}_ptrs[_k] = {v}_arr[_k];')
            deser.append(f'    char** {v} = {v}_ptrs;')
        elif cat == 'int_ptr_ptr':
            deser.append(f'    int {v}_arr[200][200]; int {v}_n = 0; int {v}_cols = 0; int* {v}_ptrs[200]; {{ char _c[40000]; strncpy(_c, {src}, 39999); _c[39999] = \'\\0\'; _parseIntMatrix(_c, {v}_arr, &{v}_n, &{v}_cols); }}')
            deser.append(f'    for (int _k = 0; _k < {v}_n; _k++) {v}_ptrs[_k] = {v}_arr[_k];')
            deser.append(f'    int** {v} = {v}_ptrs;')
        elif cat == 'char_grid':
            deser.append(f'    char {v}[9][9]; {{ char _c[20000]; strncpy(_c, {src}, 19999); _c[19999] = \'\\0\'; _parseCharGrid(_c, {v}); }}')
        else:
            deser.append(f'    char {v}[10000]; strncpy({v}, {src}, 9999); {v}[9999] = \'\\0\';')

    for a in output_params:
        i, cat = a['i'], a['cat']
        name = a['name']
        if cat == 'int_ptr':
            if any(k in name for k in ('size', 'count', 'cols', 'len')):
                deser.append(f'    int _osize_{i} = 0;')
            else:
                deser.append(f'    int _obuf_{i}[1000];')
        elif cat in ('int_ptr_ptr', 'long_ptr_ptr', 'double_ptr_ptr'):
            deser.append(f'    int* _ocols_{i} = NULL;')

    args_parts = []
    for a in analyzed:
        if a['kind'] == 'output':
            name = a['name']
            if a['cat'] == 'int_ptr':
                if any(k in name for k in ('size', 'count', 'cols', 'len')):
                    args_parts.append(f'&_osize_{a["i"]}')
                else:
                    args_parts.append(f'_obuf_{a["i"]}')
            else:
                args_parts.append(f'&_ocols_{a["i"]}')
        else:
            args_parts.append(f'_a{a["i"]}')
    args = ', '.join(args_parts)

    ret_cat = _c_classify_type(return_type)

    osize_var = None
    ocols_var = None
    ocols_ptr = False
    for a in output_params:
        if a['cat'] == 'int_ptr' and osize_var is None:
            osize_var = f'_osize_{a["i"]}'
        if a['cat'] in ('int_ptr_ptr', 'long_ptr_ptr', 'double_ptr_ptr') and ocols_var is None:
            ocols_var = f'_ocols_{a["i"]}'
            ocols_ptr = True
    if osize_var is None:
        for a in input_params:
            if a['cat'] in ('int_ptr', 'long_ptr', 'double_ptr', 'string_ptr',
                            'int_ptr_ptr', 'string_ptr_ptr'):
                osize_var = f'_a{a["i"]}_n'
                break
        if osize_var is None:
            osize_var = '0'
    if ocols_var is None:
        for a in input_params:
            if a['cat'] in ('int_ptr_ptr', 'long_ptr_ptr', 'double_ptr_ptr'):
                ocols_var = f'_a{a["i"]}_cols'
                break
        if ocols_var is None:
            ocols_var = osize_var

    call = f'    {return_type} _r = {func_name}({args});'
    if ret_cat == 'string':
        call_line = f'    char* _r = {func_name}({args});'
        print_line = '    printf("%s\\n", _r ? _r : "");'
    elif ret_cat == 'int_ptr':
        call_line = call
        print_line = f'    printf("["); for (int _pi = 0; _pi < {osize_var}; _pi++) {{ if (_pi > 0) printf(","); printf("%d", _r[_pi]); }} printf("]\\n");'
    elif ret_cat == 'long_ptr':
        call_line = call
        print_line = f'    printf("["); for (int _pi = 0; _pi < {osize_var}; _pi++) {{ if (_pi > 0) printf(","); printf("%lld", _r[_pi]); }} printf("]\\n");'
    elif ret_cat == 'double_ptr':
        call_line = call
        print_line = f'    printf("["); for (int _pi = 0; _pi < {osize_var}; _pi++) {{ if (_pi > 0) printf(","); printf("%f", _r[_pi]); }} printf("]\\n");'
    elif ret_cat == 'string_ptr':
        call_line = call
        print_line = f'    printf("["); for (int _pi = 0; _pi < {osize_var}; _pi++) {{ if (_pi > 0) printf(","); printf("\\"%s\\"", _r[_pi] ? _r[_pi] : ""); }} printf("]\\n");'
    elif ret_cat == 'int_ptr_ptr':
        call_line = call
        if ocols_ptr:
            print_line = f'    printf("["); for (int _rw = 0; _rw < {osize_var}; _rw++) {{ if (_rw > 0) printf(","); printf("["); for (int _ci = 0; _ci < {ocols_var}[_rw]; _ci++) {{ if (_ci > 0) printf(","); printf("%d", _r[_rw][_ci]); }} printf("]"); }} printf("]\\n");'
        else:
            print_line = f'    printf("["); for (int _rw = 0; _rw < {osize_var}; _rw++) {{ if (_rw > 0) printf(","); printf("["); for (int _ci = 0; _ci < {ocols_var}; _ci++) {{ if (_ci > 0) printf(","); printf("%d", _r[_rw][_ci]); }} printf("]"); }} printf("]\\n");'
    elif ret_cat == 'string_ptr_ptr':
        call_line = call
        if ocols_ptr:
            print_line = f'    printf("["); for (int _g = 0; _g < {osize_var}; _g++) {{ if (_g > 0) printf(","); printf("["); for (int _e = 0; _e < {ocols_var}[_g]; _e++) {{ if (_e > 0) printf(","); printf("\\"%s\\"", _r[_g][_e] ? _r[_g][_e] : ""); }} printf("]"); }} printf("]\\n");'
        else:
            print_line = f'    printf("["); for (int _g = 0; _g < {osize_var}; _g++) {{ if (_g > 0) printf(","); printf("["); for (int _e = 0; _e < {ocols_var}; _e++) {{ if (_e > 0) printf(","); printf("\\"%s\\"", _r[_g][_e] ? _r[_g][_e] : ""); }} printf("]"); }} printf("]\\n");'
    elif ret_cat == 'int':
        call_line = f'    int _r = {func_name}({args});'
        print_line = '    printf("%d\\n", _r);'
    elif ret_cat == 'long':
        call_line = f'    long long _r = {func_name}({args});'
        print_line = '    printf("%lld\\n", _r);'
    elif ret_cat == 'double':
        call_line = f'    double _r = {func_name}({args});'
        print_line = '    printf("%f\\n", _r);'
    elif ret_cat == 'bool':
        call_line = f'    int _r = {func_name}({args});'
        print_line = '    printf(_r ? "true" : "false"); printf("\\n");'
    elif ret_cat == 'char':
        call_line = f'    char _r = {func_name}({args});'
        print_line = '    printf("%c\\n", _r);'
    elif return_type.rstrip('*').strip() in ('void',):
        call_line = f'    {func_name}({args});'
        buf_var = None
        size_var = None
        for a in output_params:
            if a['cat'] == 'int_ptr':
                name = a['name']
                if any(k in name for k in ('size', 'count', 'cols', 'len')):
                    size_var = f'_osize_{a["i"]}'
                else:
                    buf_var = f'_obuf_{a["i"]}'
        if buf_var and size_var:
            print_line = f'    printf("["); for (int _pi = 0; _pi < {size_var}; _pi++) {{ if (_pi > 0) printf(","); printf("%d", {buf_var}[_pi]); }} printf("]\\n");'
        else:
            in_place = ''
            for a in input_params:
                if a['cat'] == 'string':
                    in_place = f'    printf("%s\\n", _a{a["i"]});'
                    break
            print_line = in_place
    else:
        call_line = f'    int _r = {func_name}({args});'
        print_line = '    printf("%d\\n", _r);'

    print_block = ('\n' + print_line) if print_line else ''
    deser_block = '\n'.join(deser)
    full_line = f'    int _full = (_lineCount >= {full_n});\n' if need_full else ''
    min_check = '' if min_n == 0 else f'    if (_lineCount < {min_n}) return 0;\n'

    return f'''int main() {{
    char _buf[20000];
    char _lines[100][20000];
    int _lineCount = 0;
    while (fgets(_buf, sizeof(_buf), stdin)) {{
        char* _t = _trim(_buf);
        if ((int)strlen(_t) > 0) {{
            strncpy(_lines[_lineCount], _t, 19999);
            _lines[_lineCount][19999] = '\\0';
            _lineCount++;
        }}
    }}
    if (_lineCount == 0) return 0;
{min_check}{full_line}{deser_block}
{call_line}{print_block}
    return 0;
}}'''


def _c_helpers():
    """Generate C helper functions."""
    return '''char* _trim(char* s) {
    if (!s) return s;
    while (*s == ' ' || *s == '\\t' || *s == '\\n' || *s == '\\r') s++;
    if (*s == '\\0') return s;
    char* end = s + strlen(s) - 1;
    while (end > s && (*end == ' ' || *end == '\\t' || *end == '\\n' || *end == '\\r')) end--;
    *(end + 1) = '\\0';
    return s;
}

void _parseIntArray(char* s, int* arr, int* n) {
    *n = 0; s = _trim(s);
    if (s[0] != '[') return;
    s++; char* end = strrchr(s, ']');
    if (end) *end = '\\0';
    char* token = strtok(s, ",");
    while (token && *n < 1000) { arr[*n] = atoi(_trim(token)); (*n)++; token = strtok(NULL, ","); }
}

void _parseLongArray(char* s, long long* arr, int* n) {
    *n = 0; s = _trim(s);
    if (s[0] != '[') return;
    s++; char* end = strrchr(s, ']');
    if (end) *end = '\\0';
    char* token = strtok(s, ",");
    while (token && *n < 1000) { arr[*n] = atoll(_trim(token)); (*n)++; token = strtok(NULL, ","); }
}

void _parseDoubleArray(char* s, double* arr, int* n) {
    *n = 0; s = _trim(s);
    if (s[0] != '[') return;
    s++; char* end = strrchr(s, ']');
    if (end) *end = '\\0';
    char* token = strtok(s, ",");
    while (token && *n < 1000) { arr[*n] = atof(_trim(token)); (*n)++; token = strtok(NULL, ","); }
}

void _parseStringArray(char* s, char arr[][256], int maxn, int* n, int* cols) {
    *n = 0; *cols = 0; s = _trim(s);
    if (s[0] != '[') return;
    char* p = s + 1;
    while (*p && *n < maxn) {
        while (*p == ' ' || *p == ',' || *p == '\\t' || *p == '\\n') p++;
        if (*p == ']' || *p == '\\0') break;
        int c = 0;
        if (*p == '[') {
            p++;
            while (*p && *p != ']' && c < 255) {
                if (*p == '"') {
                    p++;
                    if (*p && *p != '"') arr[*n][c++] = *p;
                    while (*p && *p != '"') p++;
                    if (*p == '"') p++;
                } else if (*p == ',' || *p == ' ' || *p == '\\t' || *p == '\\n') {
                    p++;
                } else {
                    arr[*n][c++] = *p; p++;
                }
            }
            if (*p == ']') p++;
        } else if (*p == '"') {
            p++;
            while (*p && *p != '"' && c < 255) { arr[*n][c++] = *p; p++; }
            if (*p == '"') p++;
        } else {
            while (*p && *p != ',' && *p != ']' && c < 255) { arr[*n][c++] = *p; p++; }
        }
        arr[*n][c] = '\\0';
        if (c > *cols) *cols = c;
        (*n)++;
    }
}

void _parseIntMatrix(char* s, int arr[][200], int* n, int* cols) {
    *n = 0; *cols = 0; s = _trim(s);
    if (s[0] != '[') return;
    char* p = s + 1;
    while (*p && *n < 200) {
        while (*p == ' ' || *p == ',' || *p == '\\t' || *p == '\\n') p++;
        if (*p == ']' || *p == '\\0') break;
        if (*p != '[') break;
        p++;
        int c = 0;
        while (*p && *p != ']' && c < 200) {
            while (*p == ' ' || *p == ',' || *p == '\\t' || *p == '\\n') p++;
            if (*p == ']' || *p == '\\0') break;
            char* tok = p;
            while (*p && *p != ',' && *p != ']') p++;
            char saved = *p;
            *p = '\\0';
            arr[*n][c++] = atoi(_trim(tok));
            *p = saved;
        }
        if (c > *cols) *cols = c;
        (*n)++;
        if (*p == ']') p++;
    }
}

void _parseCharGrid(char* s, char grid[9][9]) {
    for (int i = 0; i < 9; i++)
        for (int j = 0; j < 9; j++)
            grid[i][j] = '.';
    s = _trim(s);
    if (s[0] != '[') return;
    char* p = s + 1;
    int r = 0;
    while (*p && r < 9) {
        while (*p == ' ' || *p == ',' || *p == '\\t' || *p == '\\n' || *p == '[') p++;
        if (*p == ']' || *p == '\\0') break;
        int c = 0;
        while (*p && *p != ']' && c < 9) {
            if (*p == '"') {
                p++;
                if (*p && *p != '"') grid[r][c] = *p;
                while (*p && *p != '"') p++;
                if (*p == '"') p++;
            } else if (*p == ',' || *p == ' ' || *p == '\\t' || *p == '\\n') {
                p++;
            } else {
                grid[r][c] = *p; p++;
            }
            c++;
        }
        r++;
        if (*p == ']') p++;
    }
}

'''


def _c_driver(user_code, func_name):
    """Generate complete C driver with type-aware deserialization."""
    return_type, params = _parse_c_params(user_code, func_name)
    clean = _strip_c_boilerplate(user_code)
    main_fn = _c_typed_main(func_name, params, return_type)
    helpers = _c_helpers()

    return f'''#include<stdio.h>
#include<stdlib.h>
#include<string.h>
#include<stdbool.h>

{clean}

{helpers}

{main_fn}
'''
