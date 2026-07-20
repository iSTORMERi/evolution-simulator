console.log('Evolution Simulator Initialized');

const appContainer = document.getElementById('app');
if (appContainer) {
  appContainer.innerHTML = `
    <div style="color: white; padding: 20px; text-align: center;">
      <h1>🧬 Симулятор Эволюции</h1>
      <p style="margin-top: 10px; color: #8b949e;">Рабочее поле инициализировано. Ожидание подключения Pixi.js...</p>
    </div>
  `;
}
