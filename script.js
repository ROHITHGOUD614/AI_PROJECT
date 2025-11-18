document.getElementById('convert-btn').addEventListener('click', function() {
    const pythonCode = document.getElementById('python-code').value;
    const goCode = convertPythonToGo(pythonCode);
    document.getElementById('go-code').value = goCode;
});

function convertPythonToGo(pythonCode) {
    let goCode = pythonCode;

    // Split into lines for processing
    const lines = goCode.split('\n');
    const convertedLines = [];
    let inFunction = false;
    let inClass = false;
    let indentLevel = 0;
    let className = '';

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        const trimmed = line.trim();
        const currentIndent = line.length - line.trimStart().length;

        // Adjust indent level
        while (indentLevel > currentIndent / 4) {
            convertedLines.push('\t'.repeat(indentLevel - 1) + '}');
            indentLevel--;
        }

        if (trimmed.startsWith('import ')) {
            // Convert import to package or import
            if (trimmed.includes('os')) {
                line = line.replace(/import os/, 'import "os"');
            } else if (trimmed.includes('sys')) {
                line = line.replace(/import sys/, 'import "os"'); // Approximation
            } else {
                line = line.replace(/import /, 'import "');
                line += '"';
            }
        } else if (trimmed.startsWith('from ')) {
            // Skip or approximate
            line = '// ' + line; // Comment out for now
        } else if (trimmed.startsWith('class ')) {
            // Convert class to struct
            const match = trimmed.match(/class (\w+)/);
            if (match) {
                className = match[1];
                line = line.replace(/class \w+:/, `type ${className} struct {`);
                inClass = true;
                indentLevel++;
            }
        } else if (trimmed.startsWith('def ')) {
            // Convert def to func
            const match = trimmed.match(/def (\w+)\((.*)\):/);
            if (match) {
                const funcName = match[1];
                let params = match[2];
                params = params.replace(/self,? ?/, ''); // Remove self
                params = params.replace(/(\w+): (\w+)/g, '$1 $2'); // Type hints approximation
                if (inClass) {
                    line = line.replace(/def \w+\(.*\):/, `func (${className.toLowerCase()} *${className}) ${funcName}(${params}) {`);
                } else {
                    line = line.replace(/def \w+\(.*\):/, `func ${funcName}(${params}) {`);
                }
                inFunction = true;
                indentLevel++;
            }
        } else if (trimmed.startsWith('if ')) {
            line = line.replace(/if /, 'if ');
            line = line.replace(/:/, ' {');
            indentLevel++;
        } else if (trimmed.startsWith('elif ')) {
            line = line.replace(/elif /, '} else if ');
            line = line.replace(/:/, ' {');
            indentLevel++;
        } else if (trimmed.startsWith('else:')) {
            line = '} else {';
            indentLevel++;
        } else if (trimmed.startsWith('for ')) {
            // Basic for loop
            const match = trimmed.match(/for (\w+) in (.+):/);
            if (match) {
                const varName = match[1];
                let iterable = match[2];
                if (iterable.includes('range(')) {
                    iterable = iterable.replace(/range\((\d+)\)/, '0; $1; 1');
                    line = `for ${varName} := ${iterable} {`;
                } else {
                    line = `for _, ${varName} := range ${iterable} {`;
                }
                indentLevel++;
            }
        } else if (trimmed.startsWith('while ')) {
            line = line.replace(/while /, 'for ');
            line = line.replace(/:/, ' {');
            indentLevel++;
        } else if (trimmed.startsWith('print(')) {
            line = line.replace(/print\(/, 'fmt.Println(');
        } else if (trimmed.startsWith('return ')) {
            // Keep as is
        } else if (trimmed === 'pass') {
            line = '// pass';
        } else if (trimmed.startsWith('#')) {
            line = line.replace(/#/, '//');
        } else {
            // Variable assignments, etc.
            line = line.replace(/True/g, 'true');
            line = line.replace(/False/g, 'false');
            line = line.replace(/None/g, 'nil');
            line = line.replace(/==/g, '==');
            line = line.replace(/!=/g, '!=');
            line = line.replace(/and/g, '&&');
            line = line.replace(/or/g, '||');
            line = line.replace(/not /g, '!');
        }

        convertedLines.push(line);
    }

    // Close remaining blocks
    while (indentLevel > 0) {
        convertedLines.push('\t'.repeat(indentLevel - 1) + '}');
        indentLevel--;
    }

    goCode = convertedLines.join('\n');

    // Add package main and import fmt if not present
    if (!goCode.includes('package main')) {
        goCode = 'package main\n\nimport (\n\t"fmt"\n)\n\n' + goCode;
    }

    return goCode;
}
