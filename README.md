# Investor's Edge

A React + TypeScript web application that analyzes long-term stock investment quality based on fundamental business metrics.

## Overview

Investor's Edge evaluates whether a company is a high-quality long-term investment candidate by analyzing:

- **Revenue Growth** (5-year CAGR)
- **Earnings Per Share Growth** (5-year CAGR)
- **Free Cash Flow Growth** (5-year CAGR)
- **Return on Invested Capital** (ROIC)
- **Debt-to-Equity Ratio**
- **Profit Margins** (Gross, Operating, Net)
- **Shareholder Dilution**

All metrics are combined into a **Quality Score (0-100)** that indicates whether a business has strong fundamentals.

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure API Key**:
   - Sign up for a free API key at [Financial Modeling Prep](https://financialmodelingprep.com/developer/docs)
   - Copy `.env.example` to `.env.local`
   - Add your API key:
     ```
     FMP_API_KEY=your_api_key_here
     ```

3. **Start development server**:

   ```bash
   npm run dev
   ```

   The app will open at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` folder.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
src/
├── components/          # React components
│   ├── StockSearch.tsx         # Main search interface
│   ├── CompanyHeader.tsx        # Company profile display
│   ├── ScoreGauge.tsx           # Overall quality score display
│   ├── MetricCard.tsx           # Individual metric cards
│   ├── AnalysisTable.tsx        # Detailed metrics table
│   ├── LoadingSpinner.tsx       # Loading indicator
│   └── ErrorMessage.tsx         # Error display
├── services/            # API integration
│   └── financialModelingPrep.ts # FMP API client
├── utils/              # Business logic
│   ├── financialCalculations.ts # CAGR, margins, ratios calculations
│   └── scoring.ts               # Scoring algorithm and thresholds
├── types/              # TypeScript interfaces
│   └── index.ts        # Type definitions
├── App.tsx             # Main app component
├── main.tsx            # Entry point
└── style.css           # Tailwind directives
```

## Scoring Algorithm

### Metric Weights

- Revenue Growth: 20%
- EPS Growth: 20%
- Free Cash Flow Growth: 15%
- Return on Invested Capital: 15%
- Debt Health: 10%
- Profitability: 10%
- Shareholder Dilution: 10%

### Score Ranges

- **Excellent** (85-100): Strong fundamentals across metrics
- **Good** (70-84): Solid metrics with few concerns
- **Average** (50-69): Mixed metrics, some weaknesses
- **Poor** (0-49): Significant concerns across fundamentals

### Individual Metric Thresholds

#### Revenue Growth (5-year CAGR)

- Excellent: > 15%
- Good: 8-15%
- Fair: 0-8%
- Poor: Negative

#### EPS Growth (5-year CAGR)

- Excellent: > 15%
- Good: 5-15%
- Fair: 0-5%
- Poor: Negative

#### Free Cash Flow Growth (5-year CAGR)

- Excellent: > 10%
- Good: 5-10%
- Fair: 0-5%
- Poor: Negative

#### Return on Invested Capital (ROIC)

- Excellent: > 15%
- Good: 10-15%
- Fair: 5-10%
- Poor: < 5%

#### Debt-to-Equity Ratio

- Excellent: < 0.5 (conservative)
- Good: 0.5-1.0 (reasonable)
- Fair: 1.0-2.0 (elevated)
- Poor: > 2.0 (high risk)

#### Profitability

- Based on average of Gross, Operating, and Net margins
- Excellent: >= 20%
- Good: 10-20%
- Fair: 5-10%
- Poor: < 5%

#### Shareholder Dilution

- Positive: Share buyback or stable share count
- Neutral: Minimal change
- Negative: Share dilution

## Data Source

The application uses the **Financial Modeling Prep API** to fetch:

- Company profiles
- Income statements (5 years)
- Balance sheets (5 years)
- Cash flow statements (5 years)
- Financial ratios

Free API tier includes 250 requests per day.

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **API**: Financial Modeling Prep

## Features

✅ Stock ticker search
✅ Comprehensive fundamental analysis
✅ Quality scoring system (0-100)
✅ Responsive UI
✅ Error handling
✅ Loading states
✅ Detailed metrics breakdown

## Future Enhancements

- AI-powered explanations of scores
- Portfolio analysis
- Historical quality trends
- Peer comparison
- Stock price integration
- Watchlist functionality
- User accounts and saved analyses

## Important Disclaimers

- This tool evaluates business quality, **not** stock price movements
- Past performance does not guarantee future results
- This analysis is for educational purposes only
- Not investment advice - consult a financial advisor
- Use current company data; always verify independently

## Environment Variables

```
FMP_API_KEY  - Financial Modeling Prep API key (required)
```

## Development

### Running Linting

```bash
npm run lint
```

### TypeScript Type Checking

Types are checked during the build process.

## Troubleshooting

### "API key not found" error

- Ensure `.env.local` file exists in the project root
- Verify `FMP_API_KEY` is set correctly
- API keys are case-sensitive

### "Company not found" error

- Check ticker spelling (case-insensitive)
- Ensure it's a valid US-listed ticker
- Some companies may have limited data history

### "Rate limit exceeded" error

- The free tier has 250 requests/day
- Wait 24 hours or upgrade your API plan

## License

MIT

## Support

For issues or questions:

1. Check the [Financial Modeling Prep API docs](https://financialmodelingprep.com/developer/docs)
2. Review error messages carefully
3. Verify your API key and rate limits

## Contributing

Contributions welcome! Feel free to:

- Report bugs
- Suggest improvements
- Submit pull requests
