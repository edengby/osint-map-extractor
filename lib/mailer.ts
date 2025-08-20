import nodemailer from 'nodemailer';

export function createTransport() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
        throw new Error('Missing GMAIL_USER / GMAIL_APP_PASSWORD in environment');
    }
    return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
    });
}

export async function sendQueryEmail(opts: {
    to: string;
    from?: string;
    subject: string;
    text: string;
    html: string;
    csvFilename?: string;
    csvContent?: string; // pass a UTF-8 string (we’ll add BOM)
}) {
    const transporter = createTransport();
    const mailOptions: any = {
        to: opts.to,
        from: opts.from || process.env.GMAIL_USER!,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
    };
    if (opts.csvContent) {
        // Add UTF-8 BOM so Excel/Hebrew displays correctly
        mailOptions.attachments = [
            {
                filename: opts.csvFilename || 'results.csv',
                content: Buffer.from('\uFEFF' + opts.csvContent, 'utf8'),
                contentType: 'text/csv; charset=utf-8',
            },
        ];
    }
    await transporter.sendMail(mailOptions);
}
