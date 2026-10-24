/**
 * Stops anonymous text from notifying or cross-linking anyone on GitHub. This relay files
 * issues with a real account's token and accepts reports from anybody, so a body saying
 * `@some-user` or `@org/team` would send them a notification, and `#123`, `GH-123`,
 * `owner/repo#123` or a github.com issue URL would add a "mentioned this" entry to an
 * unrelated issue — free spam/harassment channels.
 *
 * `&`, `<` and `>` are escaped FIRST. Otherwise an HTML entity (`&#64;user`) or inline tag
 * would survive the steps below as plain characters and be decoded back into a live `@` or
 * `#` by the Markdown renderer, which is a parser differential: the sanitizer and the
 * renderer would disagree about what the text says. After escaping, every `&` is `&amp;`,
 * so no entity can be formed.
 *
 * A zero-width space after the `@`, `#` or `GH-`, and inside `github.com` host keeps the text readable but
 * no longer parses as a mention or reference. An `@` that follows a word character
 * (`name@example.com`) is an email address, not a mention, and is left alone.
 */
export function neutralizeNotifications(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(?<![A-Za-z0-9])@(?=[A-Za-z0-9_-])/g, "@\u200B")
    .replace(/#(?=\d)/g, "#\u200B")
    .replace(/(?<![A-Za-z0-9])GH-(?=\d)/gi, (prefix) => `${prefix}\u200B`)
    .replace(/github\.com/gi, (host) => `github\u200B${host.slice("github".length)}`);
}
