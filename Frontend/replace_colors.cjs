const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = [
  // Primary Backgrounds
  { regex: /bg-\[#9b87f5\]/g, replacement: 'bg-[#0b4f2a]' },
  { regex: /bg-blue-600/g, replacement: 'bg-[#0b4f2a]' },
  { regex: /bg-blue-500/g, replacement: 'bg-[#0b4f2a]' },
  { regex: /bg-purple-600/g, replacement: 'bg-[#0b4f2a]' },
  { regex: /bg-purple-500/g, replacement: 'bg-[#0b4f2a]' },
  
  // Hover states
  { regex: /hover:bg-\[#7E69AB\]/g, replacement: 'hover:bg-[#063f20]' },
  { regex: /hover:bg-blue-700/g, replacement: 'hover:bg-[#063f20]' },
  { regex: /hover:bg-blue-600/g, replacement: 'hover:bg-[#063f20]' },
  { regex: /hover:bg-purple-700/g, replacement: 'hover:bg-[#063f20]' },
  
  // Secondary Backgrounds (Badges etc)
  { regex: /bg-\[#7E69AB\]/g, replacement: 'bg-[#d7a928]' },
  { regex: /bg-purple-100/g, replacement: 'bg-[#d7a928]/20' },
  { regex: /bg-blue-100/g, replacement: 'bg-[#d7a928]/20' },
  { regex: /bg-blue-50/g, replacement: 'bg-[#d7a928]/10' },
  { regex: /bg-purple-50/g, replacement: 'bg-[#d7a928]/10' },
  
  // Text Highlights
  { regex: /text-\[#9b87f5\]/g, replacement: 'text-[#0b4f2a]' },
  { regex: /text-\[#7E69AB\]/g, replacement: 'text-[#0b4f2a]' },
  { regex: /text-blue-600/g, replacement: 'text-[#0b4f2a]' },
  { regex: /text-blue-500/g, replacement: 'text-[#0b4f2a]' },
  { regex: /text-purple-600/g, replacement: 'text-[#0b4f2a]' },
  { regex: /text-purple-500/g, replacement: 'text-[#0b4f2a]' },
  
  // Hover Text
  { regex: /hover:text-blue-700/g, replacement: 'hover:text-[#063f20]' },
  { regex: /hover:text-purple-700/g, replacement: 'hover:text-[#063f20]' },
  
  // Borders
  { regex: /border-\[#9b87f5\]/g, replacement: 'border-[#0b4f2a]' },
  { regex: /border-\[#7E69AB\]/g, replacement: 'border-[#0b4f2a]' },
  { regex: /border-blue-500/g, replacement: 'border-[#0b4f2a]' },
  { regex: /border-blue-600/g, replacement: 'border-[#0b4f2a]' },
  { regex: /border-purple-500/g, replacement: 'border-[#0b4f2a]' },
  { regex: /border-purple-200/g, replacement: 'border-[#d7a928]' },
  { regex: /border-blue-200/g, replacement: 'border-[#d7a928]' },
  
  // Focus Rings
  { regex: /focus:ring-\[#9b87f5\]/g, replacement: 'focus:ring-[#0b4f2a]' },
  { regex: /focus:ring-blue-500/g, replacement: 'focus:ring-[#0b4f2a]' },
  { regex: /focus:border-blue-500/g, replacement: 'focus:border-[#0b4f2a]' },
  
  // Fill/Stroke
  { regex: /fill-\[#9b87f5\]/g, replacement: 'fill-[#0b4f2a]' },
  { regex: /stroke-\[#9b87f5\]/g, replacement: 'stroke-[#0b4f2a]' },
  
  // Occasional raw hexes in SVG config or style props
  { regex: /#9b87f5/g, replacement: '#0b4f2a' },
  { regex: /#7E69AB/g, replacement: '#063f20' }
];

function processDirectory(directory) {
  const files = fs.readdirSync(directory);
  
  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const rule of replacements) {
        if (rule.regex.test(content)) {
          content = content.replace(rule.regex, rule.replacement);
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(srcDir);
console.log('Color replacement complete.');
