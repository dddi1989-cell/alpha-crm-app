const { Notification, BrowserWindow } = require('electron');
const { getDb } = require('./database');

let checkInterval = null;
let currentActiveUserId = null;

function setActiveUserId(userId) {
  currentActiveUserId = userId ? Number(userId) : null;
}

function getReminderLabel(offset) {
  const num = Number(offset) || 0;
  if (num === 0) return '정시 알림';
  if (num < 60) return `${num}분 전 알림`;
  if (num < 1440) return `${Math.floor(num / 60)}시간 전 알림`;
  return `${Math.floor(num / 1440)}일 전 알림`;
}

function parseDateSafely(val) {
  if (!val) return null;
  let d = new Date(val);
  if (isNaN(d.getTime())) {
    d = new Date(String(val).replace(' ', 'T'));
  }
  return isNaN(d.getTime()) ? null : d;
}

function checkUpcomingSchedules(parentWindow = null, getWidgetWindow = null) {
  try {
    const db = getDb();
    const now = new Date();

    const schedules = db.prepare(`
      SELECT s.*, c.name as customer_name, c.insurance_provider as customer_insurance_provider 
      FROM schedules s 
      LEFT JOIN customers c ON s.customer_id = c.id 
      WHERE s.status = 'Pending' AND s.notified = 0
      ORDER BY s.scheduled_at ASC
    `).all();

    schedules.forEach(schedule => {
      const scheduledTime = parseDateSafely(schedule.scheduled_at);
      if (!scheduledTime) return;

      const createdTime = parseDateSafely(schedule.created_at || schedule.updated_at) || now;
      const offsetMs = (Number(schedule.reminder_offset_minutes) || 0) * 60000;
      const notifyTime = new Date(scheduledTime.getTime() - offsetMs);

      // 1. Auto-expire very old schedules (scheduled time older than 24 hours) without popping alert
      if (scheduledTime.getTime() < now.getTime() - 86400000) {
        db.prepare('UPDATE schedules SET notified = 1 WHERE id = ?').run(schedule.id);
        return;
      }

      // 2. If the reminder offset time was ALREADY IN THE PAST when the schedule was created/updated,
      // silently mark notified = 1 so it DOES NOT pop up immediately at creation time!
      if (notifyTime.getTime() < createdTime.getTime() - 60000) {
        db.prepare('UPDATE schedules SET notified = 1 WHERE id = ?').run(schedule.id);
        return;
      }

      // 3. Trigger notification when actual reminder time is reached or passed
      if (notifyTime.getTime() <= now.getTime()) {
        // Mark as notified in DB
        db.prepare('UPDATE schedules SET notified = 1 WHERE id = ?').run(schedule.id);

        const isDirectOwner = currentActiveUserId === null || (schedule.user_id && Number(schedule.user_id) === Number(currentActiveUserId));

        // A. Show Windows Native Desktop Toast Notification (ONLY if direct owner is logged in on this PC)
        if (isDirectOwner && Notification.isSupported()) {
          const customerText = schedule.customer_name ? `\n고객명: ${schedule.customer_name}` : '';
          const reminderLabel = getReminderLabel(schedule.reminder_offset_minutes);
          const formattedDate = scheduledTime.toLocaleString('ko-KR', {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          const notif = new Notification({
            title: `[ALPHA CRM 일정 알림] ${schedule.title}`,
            body: `${schedule.description || '예정된 일정이 도래했습니다.'}${customerText}\n일시: ${formattedDate} (${reminderLabel})`,
            icon: null,
            silent: false
          });

          notif.on('click', () => {
            if (parentWindow && !parentWindow.isDestroyed()) {
              if (parentWindow.isMinimized()) parentWindow.restore();
              if (!parentWindow.isVisible()) parentWindow.show();
              parentWindow.focus();
            }
          });

          notif.show();
        }

        // B. Send schedule:due to main window (Renderer filters popup by currentUser.id)
        if (parentWindow && !parentWindow.isDestroyed()) {
          if (isDirectOwner) {
            if (parentWindow.isMinimized()) parentWindow.restore();
            if (!parentWindow.isVisible()) parentWindow.show();
            parentWindow.focus();
            parentWindow.setAlwaysOnTop(true, 'screen-saver');
            setTimeout(() => {
              if (parentWindow && !parentWindow.isDestroyed()) {
                parentWindow.setAlwaysOnTop(false);
              }
            }, 1500);
          }
          parentWindow.webContents.send('schedule:due', schedule);
        }

        // C. Notify Desktop Widget Window
        if (getWidgetWindow) {
          const widgetWin = typeof getWidgetWindow === 'function' ? getWidgetWindow() : getWidgetWindow;
          if (widgetWin && !widgetWin.isDestroyed()) {
            widgetWin.webContents.send('schedule:due', schedule);
          }
        }
      }
    });
  } catch (err) {
    console.error('Error checking upcoming schedules:', err);
  }
}

function startNotificationEngine(parentWindow = null, getWidgetWindow = null) {
  if (checkInterval) clearInterval(checkInterval);
  checkUpcomingSchedules(parentWindow, getWidgetWindow);
  // Check every 5 seconds for tight accuracy
  checkInterval = setInterval(() => {
    checkUpcomingSchedules(parentWindow, getWidgetWindow);
  }, 5000);
}

function stopNotificationEngine() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

module.exports = {
  startNotificationEngine,
  stopNotificationEngine,
  checkUpcomingSchedules,
  setActiveUserId
};
