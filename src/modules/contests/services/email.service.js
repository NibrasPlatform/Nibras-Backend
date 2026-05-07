const nodemailer = require("nodemailer");
const logger = require("../../../core/utils/logger");

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      logger.info("Email transporter initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize email transporter:", error);
    }
  }

  async sendEmail({ to, subject, html, text }) {
    try {
      if (!this.transporter) {
        throw new Error("Email transporter not initialized");
      }

      const mailOptions = {
        from: `"Nibras Platform" <${process.env.EMAIL_FROM}>`,
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Failed to send email to ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendContestReminder(user, contest) {
    const startTime = new Date(contest.startTime).toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    });

    const subject = `Reminder: ${contest.title} starts in 15 minutes!`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
          .contest-info { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4CAF50; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Contest Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>This is a friendly reminder that the contest you bookmarked is starting soon!</p>
            
            <div class="contest-info">
              <h2>${contest.title}</h2>
              <p><strong>Platform:</strong> ${contest.platform}</p>
              <p><strong>Start Time:</strong> ${startTime}</p>
              <p><strong>Duration:</strong> ${contest.duration} minutes</p>
              ${contest.numberOfProblems ? `<p><strong>Problems:</strong> ${contest.numberOfProblems}</p>` : ""}
            </div>
            
            <p>Get ready! The contest starts in approximately <strong>15 minutes</strong>.</p>
            
            <a href="${contest.url}" class="button">Go to Contest</a>
          </div>
          <div class="footer">
            <p>You're receiving this email because you set a reminder for this contest.</p>
            <p>Nibras Student Dashboard - Contest Platform</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Contest Reminder: ${contest.title}
      
      Hi ${user.name},
      
      The contest you bookmarked is starting in 15 minutes!
      
      Platform: ${contest.platform}
      Start Time: ${startTime}
      Duration: ${contest.duration} minutes
      ${contest.numberOfProblems ? `Problems: ${contest.numberOfProblems}` : ""}
      
      Contest URL: ${contest.url}
      
      Good luck!
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html,
      text,
    });
  }

  async verifyConnection() {
    try {
      if (!this.transporter) {
        throw new Error("Email transporter not initialized");
      }
      await this.transporter.verify();
      logger.info("SMTP connection verified successfully");
      return true;
    } catch (error) {
      logger.error("SMTP connection verification failed:", error);
      return false;
    }
  }
}

module.exports = new EmailService();
