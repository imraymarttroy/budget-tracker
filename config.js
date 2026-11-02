/*
 * Email delivery settings.
 *
 * A website with no server cannot send email by itself. While sendEmail is null
 * the site runs in demo mode: verification and password-reset codes are shown
 * on screen instead of being emailed.
 *
 * To send real email, set sendEmail to an async function that delivers the
 * message and throws if delivery fails. It receives:
 *   { to, toName, subject, text, code, purpose }   purpose: "verify" or "reset"
 *
 * Example using EmailJS (https://www.emailjs.com), which can be called from a
 * browser. Create a template there that uses {{to_email}}, {{to_name}},
 * {{subject}} and {{message}}, then fill in your three IDs:
 *
 *   sendEmail: async function (mail) {
 *     const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({
 *         service_id: 'YOUR_SERVICE_ID',
 *         template_id: 'YOUR_TEMPLATE_ID',
 *         user_id: 'YOUR_PUBLIC_KEY',
 *         template_params: {
 *           to_email: mail.to,
 *           to_name: mail.toName,
 *           subject: mail.subject,
 *           message: mail.text
 *         }
 *       })
 *     });
 *     if (!response.ok) throw new Error(await response.text());
 *   }
 */
window.BudgetConfig = {
  sendEmail: async function (mail) {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: 'service_roath8m',
        template_id: 'template_l8azner',
        user_id: '2NMVVHE0LHdwshsyP',
        template_params: {
          to_email: mail.to,
          to_name: mail.toName,
          subject: mail.subject,
          message: mail.text
        }
      })
    });
    if (!response.ok) throw new Error(await response.text());
  }
};
