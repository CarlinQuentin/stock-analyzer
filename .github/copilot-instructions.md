# Investor's Edge - Project Instructions

## Project Overview

This is a React + TypeScript MVP for analyzing long-term stock investment quality based on fundamental business metrics. The application integrates with the Financial Modeling Prep API to fetch financial data and calculates comprehensive quality scores.

## Technology Stack

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Axios (HTTP client)
- Financial Modeling Prep API (data source)

## Project Structure

```
src/
├── components/           # React UI components
├── services/            # API integration layer
├── utils/              # Business logic (calculations, scoring)
├── types/              # TypeScript interfaces
├── App.tsx             # Main application component
└── main.tsx            # React entry point

Configuration files:
- vite.config.ts        # Vite configuration
- tailwind.config.js    # Tailwind CSS configuration
- tsconfig.json         # TypeScript configuration
- .env.local            # Environment variables (not committed)
```

## Key Features

1. **Stock Search**: Enter a ticker symbol to analyze
2. **Financial Metrics**: 5-year CAGR for revenue, EPS, and FCF
3. **Quality Scoring**: Weighted 0-100 score based on 7 metrics
4. **Responsive UI**: Works on desktop, tablet, and mobile
5. **Error Handling**: Graceful handling of API errors and missing data

## Scoring Algorithm

- Revenue Growth: 20%
- EPS Growth: 20%
- FCF Growth: 15%
- ROIC: 15%
- Debt-to-Equity: 10%
- Profitability: 10%
- Shareholder Dilution: 10%

Score ranges: 0-50 (Poor), 50-70 (Average), 70-85 (Good), 85-100 (Excellent)

## Setup & Development

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
npm install
```

### Configuration

1. Get API key: https://financialmodelingprep.com/developer/docs (free tier available)
2. Create `.env.local` in project root:
   ```
   FMP_API_KEY=your_api_key_here
   ```

### Development Server

```bash
npm run dev
```

Access at http://localhost:5173

### Production Build

```bash
npm run build
npm run preview
```

## Development Guidelines

### File Organization

- **Components**: Place in `src/components/`, one file per component
- **API Services**: All API calls in `src/services/financialModelingPrep.ts`
- **Calculations**: Pure functions in `src/utils/financialCalculations.ts`
- **Scoring Logic**: Scoring rules in `src/utils/scoring.ts`
- **Types**: All TypeScript interfaces in `src/types/index.ts`

### Code Style

- Use React functional components with hooks
- Prefer TypeScript over JavaScript
- Use Tailwind CSS utility classes for styling
- Implement error boundaries for API failures
- Add loading states for async operations

### Component Patterns

```typescript
interface ComponentProps {
  prop1: string;
  prop2?: number;
  onEvent?: () => void;
}

export const Component: React.FC<ComponentProps> = ({ prop1, prop2, onEvent }) => {
  return <div>{/* JSX */}</div>;
};
```

## API Integration

### Financial Modeling Prep API

The service fetches:

- Company profile: `getCompanyProfile(ticker)`
- Income statements: `getIncomeStatements(ticker)`
- Balance sheets: `getBalanceSheets(ticker)`
- Cash flow statements: `getCashFlowStatements(ticker)`

### Error Handling

All API errors are handled gracefully with user-friendly messages. See `ErrorMessage.tsx` for error display patterns.

## Styling

- Use Tailwind CSS utility classes
- Custom colors in `tailwind.config.js`:
  - `excellent` (green): #10b981
  - `good` (blue): #3b82f6
  - `average` (yellow): #f59e0b
  - `poor` (red): #ef4444

## Testing the Application

1. Start dev server: `npm run dev`
2. Enter valid stock tickers (e.g., AAPL, MSFT, GOOGL)
3. Verify all metrics display correctly
4. Test error states with invalid tickers
5. Test with companies having limited data

## Common Tasks

### Adding a New Metric

1. Add to `FinancialMetrics` type in `src/types/index.ts`
2. Implement calculation in `src/utils/financialCalculations.ts`
3. Add scoring logic in `src/utils/scoring.ts`
4. Create or update `MetricCard` in UI
5. Update weights in `SCORE_WEIGHTS` if applicable

### Modifying Score Thresholds

Edit thresholds in `src/utils/scoring.ts`:

- `scoreRevenueGrowth()`
- `scoreEPSGrowth()`
- `scoreFCFGrowth()`
- `scoreROIC()`
- `scoreDebtToEquity()`
- `scoreProfitability()`
- `scoreDilution()`

### Updating UI

- Components in `src/components/`
- Styling with Tailwind in component className
- Color variables defined in `tailwind.config.js`

## Future Features (Roadmap)

- AI explanations using LLM
- Portfolio analysis
- Historical quality trends
- Peer company comparison
- Real-time stock price integration
- User authentication and accounts
- Watchlist functionality

## Troubleshooting

### "API key not found"

- Check `.env.local` exists
- Verify `FMP_API_KEY` is set correctly
- Restart dev server after changing env variables

### "Company not found"

- Verify ticker spelling
- Check it's a valid US stock
- Some companies may have insufficient data history

### Build Errors

- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npx tsc --noEmit`
- Verify all imports are correct

## Performance Considerations

- API calls are made once per search (no caching yet)
- Calculations are fast (all local)
- Bundle is optimized with Vite
- Tailwind CSS is tree-shaken in production

## Accessibility

- Semantic HTML elements
- Color combinations meet WCAG standards
- Loading and error states have clear messaging
- Responsive design works on all screen sizes

## Resources

- [Vite Docs](https://vitejs.dev/)
- [React Docs](https://react.dev/)
- [TypeScript Docs](https://www.typescriptlang.org/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [Financial Modeling Prep API Docs](https://financialmodelingprep.com/developer/docs)

## Support & Issues

Check API limits (250 requests/day free tier) and error messages. Verify data quality from the source.
