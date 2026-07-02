/* ═══════════════════════════════════════════════════════════
   Social Share — Generate shareable content for achievements
   ═══════════════════════════════════════════════════════════ */

class SocialShare {
  static generateShareText(type, data = {}) {
    const shareMessages = {
      'quest-complete': `🎉 I just completed a quest on JVDesignStudio! "${data.questTitle}" - Level ${data.level}. Can you beat my rank? 🏆 ${data.leaderboardUrl}`,
      'level-up': `⭐ I just reached Level ${data.level} on JVDesignStudio! Join me on my learning journey! 🚀 ${data.hubUrl}`,
      'achievement': `🏅 I unlocked "${data.achievementName}" on JVDesignStudio! Check out my progress: ${data.progressUrl}`,
      'rank': `📊 I'm ranked #${data.rank} on JVDesignStudio leaderboards with ${data.xp} XP! Can you climb higher? 🎯 ${data.leaderboardUrl}`,
      'cosmetic': `✨ I unlocked the "${data.cosmeticName}" cosmetic in ${data.gameName}! Play and unlock yours! 🎮 ${data.gameUrl}`
    };

    return shareMessages[type] || 'Check out my progress on JVDesignStudio!';
  }

  static copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showCopyNotification();
    }).catch(() => {
      console.warn('Failed to copy to clipboard');
    });
  }

  static showCopyNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      background: #6BCB77;
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-weight: 700;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: slideUp 0.3s ease;
    `;
    notification.textContent = '✓ Copied to clipboard!';
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  static openShareDialog(text) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: white;
      border-radius: 20px;
      padding: 32px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    `;

    content.innerHTML = `
      <h3 style="font-family: 'Fredoka', cursive; font-size: 1.5rem; margin-bottom: 16px; color: #403B33;">Share Your Achievement</h3>
      <textarea style="
        width: 100%;
        height: 120px;
        padding: 12px;
        border: 2px solid #e0e0e0;
        border-radius: 10px;
        font-family: inherit;
        font-size: 0.9rem;
        resize: none;
        margin-bottom: 16px;
      " readonly>${text}</textarea>
      <div style="display: flex; gap: 12px; margin-bottom: 16px;">
        <button style="
          flex: 1;
          background: #BC4749;
          color: white;
          border: none;
          padding: 12px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
        " onclick="SocialShare.copyToClipboard('${text.replace(/'/g, "\\'")}'); this.closest('div').parentElement.parentElement.remove();">
          📋 Copy Text
        </button>
        <button style="
          flex: 1;
          background: white;
          color: #403B33;
          border: 2px solid #e0e0e0;
          padding: 12px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
        " onclick="this.closest('div').parentElement.parentElement.remove();">
          Close
        </button>
      </div>
      <p style="font-size: 0.8rem; color: #999;">Share this text on social media to show off your progress!</p>
    `;

    dialog.appendChild(content);
    document.body.appendChild(dialog);

    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.remove();
    });
  }

  static createShareButton(type, data = {}) {
    const button = document.createElement('button');
    button.style.cssText = `
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 8px 14px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    button.innerHTML = '📤 Share';
    button.onmouseover = () => {
      button.style.background = 'rgba(255, 255, 255, 0.15)';
      button.style.color = '#f0ead6';
    };
    button.onmouseout = () => {
      button.style.background = 'rgba(255, 255, 255, 0.1)';
      button.style.color = 'rgba(255, 255, 255, 0.8)';
    };
    button.onclick = () => {
      const shareText = this.generateShareText(type, data);
      this.openShareDialog(shareText);
    };
    return button;
  }
}
