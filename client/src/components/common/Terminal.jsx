import React from 'react';

export function Terminal({ title = 'terminal', children }) {
  return (
    <div className="terminal">
      <div className="terminal-header">
        <div className="terminal-dots">
          <span className="terminal-dot red"></span>
          <span className="terminal-dot yellow"></span>
          <span className="terminal-dot green"></span>
        </div>
        <span className="terminal-title">{title}</span>
      </div>
      <div className="terminal-body">
        {children}
      </div>
    </div>
  );
}

export function TerminalLine({ type = 'output', prompt = '>', children }) {
  const className = `terminal-${type}`;

  if (type === 'command') {
    return (
      <div className="terminal-line">
        <span className="terminal-prompt">{prompt} </span>
        <span className="terminal-command">{children}</span>
      </div>
    );
  }

  return (
    <div className={`terminal-line ${className}`}>
      {children}
    </div>
  );
}

export function TerminalInput({ value, onChange, onSubmit, placeholder = 'Enter command...' }) {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && onSubmit) {
      onSubmit(value);
    }
  };

  return (
    <div className="terminal-input-line">
      <span className="terminal-prompt">{'>'}</span>
      <input
        type="text"
        className="terminal-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        autoFocus
      />
      <span className="cursor"></span>
    </div>
  );
}

export default Terminal;
