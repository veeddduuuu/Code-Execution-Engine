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

      // Define and set custom theme matching --bg-editor (#E6DED2) and --text-primary (#2D2D2D)
      monaco.editor.defineTheme("ceeTheme", {
        base: "vs",
        inherit: true,
        rules: [
          { token: "", foreground: "2D2D2D" },
          { token: "comment", foreground: "6B6560", fontStyle: "italic" },
          { token: "keyword", foreground: "B97A57", fontStyle: "bold" },
          { token: "string", foreground: "3B6D11" },
          { token: "number", foreground: "534AB7" },
        ],
        colors: {
          "editor.background": "#E6DED2",
          "editor.foreground": "#2D2D2D",
          "editorLineNumber.foreground": "#6B6560",
          "editorLineNumber.activeForeground": "#B97A57",
          "editor.lineHighlightBackground": "#DCD3C6",
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
        theme="vs"
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