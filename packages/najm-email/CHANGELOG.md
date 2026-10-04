# Changelog

## 3.0.0 - 2026-10-04

- Breaking: require Nodemailer ^10.0.14 and use its native transport/message types.
- Verify SMTP envelope, message body, and attachments against a loopback transport fixture.
