# Ultrasound Service Hub

Build a complete professional and modern web dashboard for BPL Medical Technologies focused ONLY on Ultrasound Service Calls.

IMPORTANT:

- I will provide an Excel file containing the actual Ultrasound service ticket data.

- DO NOT create fake, demo, sample, or placeholder data.

- DO NOT add X-Ray, ECG, AWS, ventilator, or any other product/category that is not present in my Excel file.

- Use ONLY the actual data from my uploaded Excel file.

- First inspect the Excel file and automatically identify its sheet names and column names.

- The dashboard must continue working if the number of rows changes when I update the Excel file.

MAIN PURPOSE:

This dashboard is for a National Service Head / Service Management team to understand the current Ultrasound service-call status, workload, ticket trends, engineers, products, zones, branches and turnaround time.

DESIGN:

- Professional corporate medical-service dashboard.

- Clean and modern interface.

- White/light background with professional blue/green accent colors.

- Do NOT use excessive gradients or childish colors.

- Desktop-first responsive design.

- Sidebar should be collapsible.

- Add a clear top navigation/header.

- Dashboard should look suitable for showing to a manager or senior management.

TOP KPI CARDS:

Create dynamic KPI cards for:

1. Total Tickets

2. Open Tickets

3. Closed Tickets

4. Pending / Other Tickets

5. Average TAT

6. Tickets created in the selected date period

Every KPI must update automatically when filters change.

FILTERS:

Create a proper filter section/sidebar with:

- Ticket ID search

- Ticket Status

- Ticket Type

- Product Category / Product / Model

- BPL Engineer

- Zone

- Branch

- Customer / Hospital

- Warranty

- System Ticket Creation Date

- Ticket Closed Date if available

- Serial Number

Add:

- Apply Filters

- Reset Filters

- Clear All Filters

All charts, KPI cards and tables must update dynamically based on these filters.

DYNAMIC CHARTS:

1. Ticket Status

- Open vs Closed vs other statuses

- Use an interactive donut/pie chart.

2. Ticket Type

- Service / PMS / AMS / other actual ticket types found in the Excel.

- Use an interactive bar chart.

3. Product / Ultrasound Model

- Show ticket count by actual product/model from the Excel.

- Do not invent model names.

4. Engineer Workload

- Ticket count handled/assigned to each BPL Engineer.

- Allow sorting.

- Show top engineers and allow viewing all engineers.

5. Zone Analysis

- Ticket count by Zone.

6. Branch Analysis

- Ticket count by Branch.

7. Monthly Ticket Trend

- Use the actual System Ticket Creation Date.

- Show monthly ticket creation trend.

- Allow filtering by date.

8. Ticket Closure Trend

- If Ticket Closed Date exists, show monthly closure trend.

9. TAT Analysis

- Calculate TAT using:

  Ticket Closed Date - System Ticket Creation Date

- Show Average TAT.

- Show TAT distribution.

- Show average TAT by engineer if the required dates exist.

- Do not calculate TAT for tickets where the required dates are missing.

INTERACTIVE BEHAVIOR:

Charts must not be static.

If possible:

- Clicking a chart category should filter the ticket table below.

- Clicking an engineer should show that engineer's tickets.

- Clicking a product/model should show tickets for that model.

- Clicking Open/Closed should show the corresponding tickets.

If chart-click filtering is technically difficult, provide dropdown/button filters that produce the same result.

TICKET TABLE:

Create a detailed ticket table below the charts.

Include the actual relevant columns from the Excel, such as:

- Ticket ID

- Customer Name

- System Ticket Creation Date

- Ticket Closed Date

- Ticket Status

- Ticket Type

- Product / Model

- Serial Number

- BPL Engineer

- Branch

- Zone

- Warranty

- City

- State

- TAT

Do not assume these exact names if my Excel uses different names. Map the actual Excel columns correctly.

Add:

- Search

- Sort

- Pagination

- Column selection

- Download filtered data as CSV/Excel

TICKET DETAIL VIEW:

When I select a Ticket ID, show a detailed ticket information section/card containing all available information for that ticket.

DATA HANDLING:

- Read the actual uploaded Excel file.

- Detect the correct worksheet automatically or provide a worksheet selector.

- Automatically recognize date columns.

- Handle blank/null values safely.

- Handle duplicate Ticket IDs without crashing.

- Do not replace missing values with fake information.

- Do not modify the original Excel file.

- If a required column does not exist, hide that feature instead of crashing the whole dashboard.

- Show a clear message explaining which column is missing.

REFRESH:

Add a Refresh / Reload Data button.

The dashboard should reload the Excel file when the file is updated.

IMPORTANT DATA RULE:

The dashboard must always reflect the actual Excel data.

For example:

If the Excel contains 2,843 tickets, the Total Tickets KPI should show 2,843 before filters.

If the Excel contains only Ultrasound records, the dashboard must show only Ultrasound records.

Never create additional records.

TECHNICAL REQUIREMENTS:

- Build this as a complete working application.

- Provide all source files.

- Provide requirements/dependencies.

- Provide a simple README explaining exactly how to run it.

- Include a one-click/run script if possible.

- Make sure there are no missing dependencies.

- Test the application before providing it.

- The application should start without errors.

- Avoid unnecessary external APIs.

- It should work locally with my Excel file.

IMPORTANT:

Before building the dashboard, inspect the uploaded Excel file and use its REAL structure.

Do not guess column names.

Do not create example data.

Do not show unrelated medical equipment categories.

FINAL RESULT:

I want a complete working BPL Medical Ultrasound Service Dashboard where I can simply provide/update my Excel file and the entire dashboard automatically updates:

KPIs → Filters → Charts → Engineer analysis → Product analysis → Zone/Branch analysis → TAT → Ticket details.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ultrasafe-insight.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7bb30b89-1f05-5a81-bcdf-711ef9f8351f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
