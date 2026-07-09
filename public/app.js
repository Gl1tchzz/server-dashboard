let logSocket = null;

async function loadContainers() {
  const res = await fetch('/api/containers');
  const containers = await res.json();
  const cards = document.getElementById('cards');
  cards.innerHTML = '';

  containers.forEach(container => {
    const stateClass = container.state === 'running'
      ? 'running'
      : container.state === 'exited'
      ? 'stopped'
      : 'other';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>${container.name}</h2>
      <div class="status">
        <span class="dot ${stateClass}"></span>
        ${container.state}
      </div>
      <p>${container.status}</p>
      <p><strong>Image:</strong> ${container.image}</p>
      <div class="actions">
        <button onclick="viewLogs('${container.name}')">Live Logs</button>
        <button onclick="containerAction('${container.name}','restart')">Restart</button>
        <button onclick="containerAction('${container.name}','start')">Start</button>
        <button onclick="containerAction('${container.name}','stop')">Stop</button>
        ${container.name === 'macbook-tracker'
          ? `<button onclick="deployTracker()">Deploy Latest</button>`
          : ''
        }
      </div>
    `;
    cards.appendChild(card);
  });
}

async function containerAction(name, action) {
  await fetch(`/api/containers/${name}/${action}`, {
    method: 'POST'
  });
  setTimeout(loadContainers, 800);
}

async function deployTracker() {
  const terminal = document.getElementById('terminal');
  terminal.textContent = 'Deploying MacBook Tracker...\n';

  const res = await fetch('/api/deploy/macbook-tracker', {
    method: 'POST'
  });
  const data = await res.json();
  terminal.textContent += (data.stdout || '') + (data.stderr || '');

  if (data.error) {
    terminal.textContent += '\nERROR: ' + data.error;
  }

  loadContainers();
}

function viewLogs(container) {
  document.getElementById('terminal-title').textContent = `${container} Live Terminal`;
  const terminal = document.getElementById('terminal');
  terminal.textContent = '';

  if (logSocket) {
    logSocket.close();
  }

  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  logSocket = new WebSocket(`${protocol}://${location.host}?container=${container}`);

  logSocket.onmessage = event => {
    terminal.textContent += event.data;
    terminal.scrollTop = terminal.scrollHeight;
  };

  logSocket.onclose = () => {
    terminal.textContent += '\n[Log connection closed]\n';
  };
}

function clearLogs() {
  document.getElementById('terminal').textContent = '';
}

// Initialize
loadContainers();
setInterval(loadContainers, 5000);
