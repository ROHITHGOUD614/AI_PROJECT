const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Note: node-fetch is needed for Node.js

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files from current directory

const OPENAI_API_KEY = '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';

app.post('/convert', async (req, res) => {
    const { pythonCode } = req.body;
    if (!pythonCode) {
        return res.status(400).json({ error: 'Python code is required' });
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a code translator. Convert the given Python code to equivalent Go code. Provide only the Go code without explanations.'
                    },
                    {
                        role: 'user',
                        content: `Convert this Python code to Go:\n\n${pythonCode}`
                    }
                ],
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        const goCode = data.choices[0].message.content.trim();
        res.json({ goCode });
    } catch (error) {
        // Fallback to basic conversion if API fails
        const goCode = basicConvertPythonToGo(pythonCode);
        res.json({ goCode: `// Fallback conversion:\n${goCode}` });
    }
});

function basicConvertPythonToGo(pythonCode) {
    const lines = pythonCode.split('\n');
    const structLines = [];
    const methodLines = [];
    let inClass = false;
    let className = '';
    let indentLevel = 0;

    for (let line of lines) {
        const trimmed = line.trim();
        const currentIndent = line.length - line.trimStart().length;

        // Adjust indent
        while (indentLevel > currentIndent / 4) {
            if (inClass) {
                structLines.push('\t'.repeat(indentLevel - 1) + '}');
            } else {
                methodLines.push('\t'.repeat(indentLevel - 1) + '}');
            }
            indentLevel--;
        }

        if (trimmed.startsWith('import ')) {
            if (trimmed.includes('json')) {
                line = line.replace(/import json/, 'import "encoding/json"');
            } else if (trimmed.includes('os')) {
                line = line.replace(/import os/, 'import "os"');
            } else if (trimmed.includes('sys')) {
                line = line.replace(/import sys/, 'import "os"');
            }
            methodLines.push(line);
        } else if (trimmed.startsWith('class ')) {
            const match = trimmed.match(/class (\w+)/);
            if (match) {
                className = match[1];
                structLines.push(`type ${className} struct {`);
                inClass = true;
                indentLevel++;
            }
        } else if (trimmed.startsWith('def __init__')) {
            const match = trimmed.match(/def __init__\(self, (.*)\):/);
            if (match) {
                const params = match[1];
                methodLines.push(`func New${className}(${params}) *${className} {`);
                methodLines.push(`\treturn &${className}{}`);
                methodLines.push('}');
            }
        } else if (trimmed.startsWith('def ')) {
            const match = trimmed.match(/def (\w+)\(self(?:, (.*))?\):/);
            if (match) {
                const funcName = match[1];
                const params = match[2] || '';
                methodLines.push(`func (s *${className}) ${funcName}(${params}) {`);
                indentLevel++;
            }
        } else if (inClass && trimmed) {
            // Struct fields
            if (trimmed.includes('=')) {
                // Skip assignments in struct
            } else {
                structLines.push('\t' + trimmed);
            }
        } else if (!inClass) {
            // Other code
            line = line.replace(/print\(/g, 'fmt.Println(');
            line = line.replace(/True/g, 'true');
            line = line.replace(/False/g, 'false');
            line = line.replace(/None/g, 'nil');
            line = line.replace(/and/g, '&&');
            line = line.replace(/or/g, '||');
            line = line.replace(/not /g, '!');
            line = line.replace(/self\./g, 's.');
            line = line.replace(/input\(/g, 'readInput(');
            line = line.replace(/f"(.+)"/g, 'fmt.Sprintf("$1")');
            line = line.replace(/\.append\(/g, ' = append(');
            line = line.replace(/any\((.+)\)/g, 'contains($1)');
            line = line.replace(/with open\((.+), "r"\) as f:/g, 'file, err := os.Open($1)\nif err != nil {\n\tpanic(err)\n}\ndefer file.Close()');
            line = line.replace(/with open\((.+), "w"\) as f:/g, 'file, err := os.Create($1)\nif err != nil {\n\tpanic(err)\n}\ndefer file.Close()');
            line = line.replace(/json\.dump\((.+), f\)/g, 'data, _ := json.Marshal($1)\nfile.Write(data)');
            line = line.replace(/json\.load\(f\)/g, 'var data []byte\nfile.Read(data)\nvar result interface{}\njson.Unmarshal(data, &result)');
            line = line.replace(/try:/g, '');
            line = line.replace(/except:/g, 'if err != nil {');
            line = line.replace(/pass/g, '// pass');
            line = line.replace(/#/g, '//');
            line = line.replace(/'/g, '"');
            line = line.replace(/for (\w+) in range\((\d+)\):/g, 'for $1 := 0; $1 < $2; $1++ {');
            line = line.replace(/for (\w+) in (.+):/g, 'for _, $1 := range $2 {');
            line = line.replace(/elif /g, '} else if ');
            line = line.replace(/else:/g, '} else {');
            line = line.replace(/if (.+):/g, 'if $1 {');
            line = line.replace(/while (.+):/g, 'for $1 {');
            line = line.replace(/:/g, ' {');
            methodLines.push(line);
        }
    }

    // Close remaining
    while (indentLevel > 0) {
        if (inClass) {
            structLines.push('\t'.repeat(indentLevel - 1) + '}');
        } else {
            methodLines.push('\t'.repeat(indentLevel - 1) + '}');
        }
        indentLevel--;
    }

    let goCode = 'package main\n\nimport (\n\t"fmt"\n\t"encoding/json"\n\t"os"\n\t"bufio"\n\t"strings"\n)\n\n';

    goCode += structLines.join('\n') + '\n\n';
    goCode += methodLines.join('\n');

    // Add helpers
    goCode += '\n\nfunc contains(slice []interface{}, item interface{}) bool {\n\tfor _, v := range slice {\n\t\tif v == item {\n\t\t\treturn true\n\t\t}\n\t}\n\treturn false\n}\n\nfunc readInput(prompt string) string {\n\tfmt.Print(prompt)\n\tscanner := bufio.NewScanner(os.Stdin)\n\tscanner.Scan()\n\treturn strings.TrimSpace(scanner.Text())\n}';

    return goCode;
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
