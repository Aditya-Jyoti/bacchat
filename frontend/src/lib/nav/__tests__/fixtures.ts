/** Realistic samples of the public NAV files (values invented, layout as published). */

export const AMFI_SAMPLE = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date

Open Ended Schemes(Equity Scheme - Large Cap Fund)

Axis Mutual Fund

120465;INF846K01DP8;-;Axis Bluechip Fund - Direct Plan - Growth;62.5000;23-Oct-2026
120466;INF846K01DQ6;INF846K01DR4;Axis Bluechip Fund - Direct Plan - IDCW;21.1234;23-Oct-2026
119551;INF846K01131;-;Axis Bluechip Fund - Regular Plan - Growth;N.A.;23-Oct-2026

Open Ended Schemes(Equity Scheme - Flexi Cap Fund)

PPFAS Mutual Fund

122639;INF879O01027;-;Parag Parikh Flexi Cap Fund - Direct Plan - Growth;80.0000;23-Oct-2026

HDFC Mutual Fund

118989;INF179K01VQ7;-;HDFC Mid-Cap Opportunities Fund - Direct Plan - Growth Option;150.0000;23-Oct-2026
bad line without enough fields;1;2
abc;INF000;-;Not numeric code;10.00;23-Oct-2026
100001;-;-;Broken date scheme;10.00;31-Foo-2026
100002;-;-;No NAV scheme;;23-Oct-2026

Close Ended Schemes(Income)

Some Mutual Fund

140001;-;-;Fixed Term Plan; Series 5 (1,200 days);1,010.5000;23-Oct-2026
`;

export const AMFI_MIN = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date
\r
Open Ended Schemes(Equity Scheme - Large Cap Fund)\r
\r
Axis Mutual Fund\r
120465;INF846K01DP8;-;Axis Bluechip Fund - Direct Plan - Growth;63.1000;24-Oct-2026\r
`;

export const NPS_CSV = `PFM Name,Scheme ID,Scheme Name,NAV,Date
SBI Pension Funds,SM001003,"SBI PENSION FUND SCHEME C - TIER I",31.2800,23-10-2026
SBI Pension Funds,SM001004,"SBI PENSION FUND SCHEME E - TIER I",52.1043,23-10-2026
HDFC Pension,SM008003,HDFC PENSION MANAGEMENT COMPANY LIMITED SCHEME C - TIER I,N.A.,23-10-2026
LIC Pension,SM003001,"LIC PENSION FUND SCHEME ""G"" - TIER I",28.9001,23/10/2026
`;

export const NPS_CSV_NO_DATE = `Scheme Code,Scheme Name,NAV
SM001003,SBI PENSION FUND SCHEME C - TIER I,31.2800
SM001004,SBI PENSION FUND SCHEME E - TIER I,52.1043
`;

export const NPS_HTML = `<html><body><h2>NPS NAV</h2>
<table class="nav"><thead><tr><th>Scheme ID</th><th>Scheme&nbsp;Name</th><th>NAV</th><th>Date</th></tr></thead>
<tbody>
<tr><td>SM001003</td><td>SBI Pension Fund &amp; Scheme C - Tier I</td><td>31.2800</td><td>2026-10-23</td></tr>
<tr><td>SM001004</td><td><a href="#">SBI Pension Fund Scheme E - Tier I</a></td><td>52.1043</td><td>2026-10-23</td></tr>
<tr><td>SM009999</td><td>Broken</td><td>--</td><td>2026-10-23</td></tr>
</tbody></table></body></html>`;
