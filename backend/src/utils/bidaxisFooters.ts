function signature(tagline: string, person: string, contactHtml: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;">
  <tr>
    <td valign="middle" style="padding:8px 18px 8px 0;border-right:3px solid #1B6FE8;">
      <div style="font-size:26px;line-height:1;font-weight:800;letter-spacing:-0.6px;color:#0B1F3A;">Bid<span style="color:#1B6FE8;">Axis</span><span style="color:#1B6FE8;font-weight:700;">.co</span></div>
      <div style="margin-top:6px;font-size:9px;letter-spacing:1.6px;color:#94A3B8;">${tagline}</div>
    </td>
    <td valign="middle" style="padding:8px 0 8px 18px;">
      <div style="font-size:18px;line-height:1.2;font-weight:700;color:#0B1F3A;">${person}</div>
      <div style="margin-top:3px;font-size:13px;color:#64748B;">Managing Partner &nbsp;|&nbsp; BidAxis</div>
      <div style="margin-top:8px;font-size:13px;line-height:1.55;color:#334155;">${contactHtml}</div>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding-top:12px;font-size:11px;letter-spacing:1.4px;color:#94A3B8;">PRECONSTRUCTION &nbsp;|&nbsp; ESTIMATING &nbsp;|&nbsp; PROJECT INTELLIGENCE</td>
  </tr>
</table>`;
}

export function bidaxisFooterFor(email: string): string {
  const key = email.trim().toLowerCase();
  if (key === "info@bidaxis.co") {
    return signature(
      "PRECONSTRUCTION",
      "Daniel Parker",
      `P &nbsp; +1 727 496 0673<br>E &nbsp; <a href="mailto:info@bidaxis.co" style="color:#1B6FE8;text-decoration:none;">info@bidaxis.co</a><br>W &nbsp; <a href="https://bidaxis.co" style="color:#1B6FE8;text-decoration:none;">bidaxis.co</a>`,
    );
  }
  if (key === "sales@bidaxis.co") {
    return signature(
      "FREE CONSTRUCTION",
      "Emma Collins",
      `<a href="mailto:sales@bidaxis.co" style="color:#1B6FE8;text-decoration:none;">sales@bidaxis.co</a><br><a href="https://bidaxis.co" style="color:#1B6FE8;text-decoration:none;">bidaxis.co</a>`,
    );
  }
  return "";
}
