import type { ReactElement } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { UiLanguageProvider } from '../../../contexts/UiLanguageContext';
import { UI_LANGUAGE_STORAGE_KEY } from '../../../utils/uiLanguage';
import { StockCodeField } from '../StockCodeField';

const { getWatchlist, getSnapshot } = vi.hoisted(() => ({
  getWatchlist: vi.fn(),
  getSnapshot: vi.fn(),
}));

vi.mock('../../../api/systemConfig', () => ({
  systemConfigApi: {
    getWatchlist,
    addToWatchlist: vi.fn(),
    removeFromWatchlist: vi.fn(),
  },
}));

vi.mock('../../../api/portfolio', () => ({
  portfolioApi: {
    getSnapshot,
  },
}));

vi.mock('../../StockAutocomplete', () => ({
  StockAutocomplete: ({
    value,
    onChange,
    onSubmit,
    placeholder,
    ariaLabel,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (code: string) => void;
    placeholder?: string;
    ariaLabel?: string;
    disabled?: boolean;
  }) => (
    <input
      value={value}
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onSubmit(value);
      }}
      data-testid="stock-code-field-input"
    />
  ),
}));

function renderField(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <UiLanguageProvider>{ui}</UiLanguageProvider>
    </MemoryRouter>,
  );
}

describe('StockCodeField', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, 'zh');
    getWatchlist.mockReset();
    getSnapshot.mockReset();
    getWatchlist.mockResolvedValue(['600519', 'AAPL']);
    getSnapshot.mockResolvedValue({ positions: [] });
  });

  it('renders watchlist chips and fills value on pick', async () => {
    const onChange = vi.fn();
    const onSelectCandidate = vi.fn();

    renderField(
      <StockCodeField
        value=""
        onChange={onChange}
        onSelectCandidate={onSelectCandidate}
        ariaLabel="股票代码"
        sources={['watchlist']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('我的自选')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('从自选选择')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^600519$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^AAPL$/ })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('从自选选择'), { target: { value: '600519' } });
    expect(onChange).toHaveBeenCalledWith('600519');
    expect(onSelectCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ code: '600519', source: 'watchlist' }),
    );
  });

  it('shows empty watchlist hint with diagnose link', async () => {
    getWatchlist.mockResolvedValue([]);

    renderField(
      <StockCodeField
        value=""
        onChange={vi.fn()}
        ariaLabel="股票代码"
        sources={['watchlist']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/自选为空/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: '去诊股添加自选' })).toHaveAttribute('href', '/analysis');
  });

  it('renders history and popular extra candidates in groups', async () => {
    renderField(
      <StockCodeField
        value=""
        onChange={vi.fn()}
        ariaLabel="股票代码"
        sources={['watchlist', 'history', 'popular']}
        extraCandidates={[
          { code: '300750', displayCode: '300750', name: '宁德时代', source: 'history' },
          { code: '000001', displayCode: '000001', name: '平安银行', source: 'popular' },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('最近分析')).toBeInTheDocument();
    });
    expect(screen.getByText('热门候选')).toBeInTheDocument();
    expect(screen.getByText('宁德时代')).toBeInTheDocument();
    expect(screen.getByText('平安银行')).toBeInTheDocument();
  });

  it('loads portfolio candidates when enabled', async () => {
    getSnapshot.mockResolvedValue({
      positions: [
        { symbol: '002594', market: 'cn', quantity: 100 },
        { symbol: '002594', market: 'cn', quantity: 50 },
      ],
    });

    renderField(
      <StockCodeField
        value=""
        onChange={vi.fn()}
        ariaLabel="股票代码"
        sources={['watchlist', 'portfolio']}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('我的持仓')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /002594/ })).toBeInTheDocument();
  });
});
