import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { Toast, ToastContainer, type ToastItem, type ToastType, type ToastPosition } from './Toast';

// Mock timers for testing auto-dismiss functionality
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast Component', () => {
  const mockOnRemove = vi.fn();

  const createMockToast = (overrides: Partial<ToastItem> = {}): ToastItem => ({
    id: 'test-toast-1',
    type: 'info',
    message: 'Test message',
    duration: 4000,
    ...overrides,
  });

  beforeEach(() => {
    mockOnRemove.mockClear();
  });

  test('should render toast with basic message', () => {
    const toast = createMockToast();
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
    expect(screen.getByText('ℹ️')).toBeInTheDocument();
  });

  test('should render toast with title and message', () => {
    const toast = createMockToast({
      title: 'Test Title',
      message: 'Test message',
    });
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  test('should render different toast types with correct icons', () => {
    const types: { type: ToastType; icon: string }[] = [
      { type: 'success', icon: '✅' },
      { type: 'error', icon: '❌' },
      { type: 'warning', icon: '⚠️' },
      { type: 'info', icon: 'ℹ️' },
    ];

    types.forEach(({ type, icon }) => {
      const toast = createMockToast({ type });
      const { unmount } = render(<Toast toast={toast} onRemove={mockOnRemove} />);
      
      expect(screen.getByText(icon)).toBeInTheDocument();
      
      unmount();
    });
  });

  test('should auto-dismiss after duration', async () => {
    const toast = createMockToast({ duration: 2000 });
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    expect(mockOnRemove).not.toHaveBeenCalled();

    // Fast-forward time to trigger auto-dismiss
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Wait for the removal timeout (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockOnRemove).toHaveBeenCalledWith('test-toast-1');
  });

  test('should not auto-dismiss when persistent', () => {
    const toast = createMockToast({ persistent: true, duration: 1000 });
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  test('should not auto-dismiss when duration is 0', () => {
    const toast = createMockToast({ duration: 0 });
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockOnRemove).not.toHaveBeenCalled();
  });

  test('should handle click to dismiss', () => {
    const toast = createMockToast();
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    const toastElement = screen.getByTestId('toast-test-toast-1');
    fireEvent.click(toastElement);

    // Wait for the removal timeout (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockOnRemove).toHaveBeenCalledWith('test-toast-1');
  });

  test('should handle close button click', () => {
    const toast = createMockToast();
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    const closeButton = screen.getByLabelText('Close notification');
    fireEvent.click(closeButton);

    // Wait for the removal timeout (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockOnRemove).toHaveBeenCalledWith('test-toast-1');
  });

  test('should prevent event propagation on close button click', () => {
    const toast = createMockToast();
    render(<Toast toast={toast} onRemove={mockOnRemove} />);

    const closeButton = screen.getByLabelText('Close notification');
    
    // Create a spy for stopPropagation
    const stopPropagationSpy = vi.fn();
    
    // Mock Event.prototype.stopPropagation
    const originalStopPropagation = Event.prototype.stopPropagation;
    Event.prototype.stopPropagation = stopPropagationSpy;

    // Trigger the click event 
    fireEvent.click(closeButton);

    // Restore the original method
    Event.prototype.stopPropagation = originalStopPropagation;

    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  test('should apply correct CSS classes for each type', () => {
    const types: ToastType[] = ['success', 'error', 'warning', 'info'];

    types.forEach((type) => {
      const toast = createMockToast({ type });
      const { unmount } = render(<Toast toast={toast} onRemove={mockOnRemove} />);
      
      const toastElement = screen.getByTestId('toast-test-toast-1');
      expect(toastElement).toHaveClass('rounded-lg', 'border', 'shadow-lg');
      
      unmount();
    });
  });
});

describe('ToastContainer Component', () => {
  const mockOnRemove = vi.fn();

  const createMockToasts = (count: number): ToastItem[] => {
    return Array.from({ length: count }, (_, index) => ({
      id: `toast-${index}`,
      type: 'info' as ToastType,
      message: `Message ${index}`,
      duration: 4000,
    }));
  };

  beforeEach(() => {
    mockOnRemove.mockClear();
  });

  test('should render nothing when no toasts', () => {
    const { container } = render(
      <ToastContainer toasts={[]} onRemove={mockOnRemove} />
    );

    expect(container.firstChild).toBeNull();
  });

  test('should render multiple toasts', () => {
    const toasts = createMockToasts(3);
    render(<ToastContainer toasts={toasts} onRemove={mockOnRemove} />);

    expect(screen.getByText('Message 0')).toBeInTheDocument();
    expect(screen.getByText('Message 1')).toBeInTheDocument();
    expect(screen.getByText('Message 2')).toBeInTheDocument();
  });

  test('should apply correct position classes', () => {
    const positions: { position: ToastPosition; expectedClass: string }[] = [
      { position: 'top-right', expectedClass: 'top-4 right-4' },
      { position: 'top-left', expectedClass: 'top-4 left-4' },
      { position: 'bottom-right', expectedClass: 'bottom-4 right-4' },
      { position: 'bottom-left', expectedClass: 'bottom-4 left-4' },
      { position: 'top-center', expectedClass: 'top-4 left-1/2' },
      { position: 'bottom-center', expectedClass: 'bottom-4 left-1/2' },
    ];

    positions.forEach(({ position, expectedClass }) => {
      const toasts = createMockToasts(1);
      const { unmount } = render(
        <ToastContainer toasts={toasts} onRemove={mockOnRemove} position={position} />
      );

      const container = screen.getByRole('region', { name: 'Notifications' });
      expect(container).toHaveClass(expectedClass);

      unmount();
    });
  });

  test('should have proper accessibility attributes', () => {
    const toasts = createMockToasts(1);
    render(<ToastContainer toasts={toasts} onRemove={mockOnRemove} />);

    const container = screen.getByRole('region', { name: 'Notifications' });
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('fixed', 'z-50');
  });

  test('should handle toast removal', () => {
    const toasts = createMockToasts(2);
    render(<ToastContainer toasts={toasts} onRemove={mockOnRemove} />);

    const firstToast = screen.getByTestId('toast-toast-0');
    fireEvent.click(firstToast);

    // Wait for the removal timeout (200ms)
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockOnRemove).toHaveBeenCalledWith('toast-0');
  });
}); 