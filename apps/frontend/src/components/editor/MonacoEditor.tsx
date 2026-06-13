import { forwardRef, useImperativeHandle, useRef } from "react";
import Editor, { Monaco } from "@monaco-editor/react";

export interface MonacoEditorRef {
  getValue: () => string;
  setValue: (value: string) => void;
}

interface MonacoEditorProps {
  defaultCode?: string;
  onRun: (code: string) => void;
}

export const MonacoEditor = forwardRef<MonacoEditorRef, MonacoEditorProps>(
  ({ defaultCode, onRun }, ref) => {
    const editorRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      getValue: () => {
        return editorRef.current ? editorRef.current.getValue() : "";
      },
      setValue: (value: string) => {
        if (editorRef.current) {
          editorRef.current.setValue(value);
        }
      }
    }));

    const handleEditorDidMount = (editor: any, monaco: Monaco) => {
      editorRef.current = editor;

      // Define and set custom theme matching --bg-editor (#161616) and --text-primary (#e0e0e0)
      monaco.editor.defineTheme("ceeTheme", {
        base: "vs-dark",
        inherit: true,
        rules: [
          { token: "", foreground: "E0E0E0" },
          { token: "comment", foreground: "888888", fontStyle: "italic" },
          { token: "keyword", foreground: "22C55E", fontStyle: "bold" },
          { token: "string", foreground: "22C55E" },
          { token: "number", foreground: "3B82F6" },
        ],
        colors: {
          "editor.background": "#161616",
          "editor.foreground": "#E0E0E0",
          "editorLineNumber.foreground": "#888888",
          "editorLineNumber.activeForeground": "#22C55E",
          "editor.lineHighlightBackground": "#1A1A1A",
        },
      });

      monaco.editor.setTheme("ceeTheme");

      // Register Ctrl+Enter / Cmd+Enter Action
      editor.addAction({
        id: "run-code-action",
        label: "Run Code",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
        precondition: undefined,
        keybindingContext: undefined,
        contextMenuGroupId: "navigation",
        contextMenuOrder: 1.5,
        run: (ed: any) => {
          onRun(ed.getValue());
        },
      });
    };

    return (
      <Editor
        height="100%"
        defaultLanguage="javascript"
        theme="vs-dark"
        defaultValue={defaultCode}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          lineNumbers: "on",
          roundedSelection: false,
          readOnly: false,
        }}
      />
    );
  }
);

MonacoEditor.displayName = "MonacoEditor";