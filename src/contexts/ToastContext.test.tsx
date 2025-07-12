import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { ReactNode } from 'react';
import { ToastProvider, useToast } from './ToastContext';

// Mock timers for testing auto-dismiss functionality
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  const TestComponent = ({ children }: { children?: ReactNode }) => (
    <ToastProvider>{children}</ToastProvider>
  );

  test('should render children without errors', () => {
    render(
      <TestComponent>
        <div>Test Content</div>
      </TestComponent>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  test('should provide toast context to children', () => {
    const TestChild = () => {
      const { showInfo } = useToast();
      return (
        <button onClick={() => showInfo('Test message')}>
          Show Toast
        </button>
      );
    };

    render(
      <TestComponent>
        <TestChild />
      </TestComponent>
    );

    const button = screen.getByText('Show Toast');
    fireEvent.click(button);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  test('should support custom position', () => {
    const TestChild = () => {
      const { showInfo } = useToast();
      return (
        <button onClick={() => showInfo('Test message')}>
          Show Toast
        </button>
      );
    };

    render(
      <ToastProvider position="bottom-left">
        <TestChild />
      </ToastProvider>
    );

    const button = screen.getByText('Show Toast');
    fireEvent.click(button);

    const container = screen.getByRole('region', { name: 'Notifications' });
    expect(container).toHaveClass('bottom-4', 'left-4');
  });

  test('should limit maximum number of toasts', () => {
    const TestChild = () => {
      const { showInfo } = useToast();
      return (
        <button onClick={() => {
          for (let i = 0; i < 7; i++) {
            showInfo(`Message ${i}`);
          }
        }}>
          Show Many Toasts
        </button>
      );
    };

    render(
      <ToastProvider maxToasts={3}>
        <TestChild />
      </ToastProvider>
    );

    const button = screen.getByText('Show Many Toasts');
    fireEvent.click(button);

    // Should only show the first 3 toasts due to limit
    expect(screen.getByText('Message 6')).toBeInTheDocument();
    expect(screen.getByText('Message 5')).toBeInTheDocument();
    expect(screen.getByText('Message 4')).toBeInTheDocument();
    expect(screen.queryByText('Message 3')).not.toBeInTheDocument();
  });
});

describe('useToast hook', () => {
  test('should throw error when used outside ToastProvider', () => {
    const TestComponent = () => {
      useToast();
      return <div>Test</div>;
    };

    // Suppress console.error for this test
    const originalError = console.error;
    console.error = vi.fn();

    expect(() => render(<TestComponent />)).toThrow(
      'useToast must be used within a ToastProvider'
    );

    console.error = originalError;
  });

  test('should return toast context when used within provider', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    expect(result.current).toBeDefined();
    expect(typeof result.current.showSuccess).toBe('function');
    expect(typeof result.current.showError).toBe('function');
    expect(typeof result.current.showWarning).toBe('function');
    expect(typeof result.current.showInfo).toBe('function');
  });

  test('should show success toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.showSuccess('Success message', 'Success Title');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('success');
    expect(result.current.toasts[0].message).toBe('Success message');
    expect(result.current.toasts[0].title).toBe('Success Title');
  });

  test('should show error toast with longer duration', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.showError('Error message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('error');
    expect(result.current.toasts[0].message).toBe('Error message');
    expect(result.current.toasts[0].duration).toBe(6000);
  });

  test('should show warning toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.showWarning('Warning message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('warning');
    expect(result.current.toasts[0].duration).toBe(5000);
  });

  test('should show info toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.showInfo('Info message');
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].type).toBe('info');
    expect(result.current.toasts[0].duration).toBe(4000);
  });

  test('should add custom toast with addToast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.addToast({
        type: 'success',
        message: 'Custom toast',
        duration: 2000,
        persistent: true,
      });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('Custom toast');
    expect(result.current.toasts[0].duration).toBe(2000);
    expect(result.current.toasts[0].persistent).toBe(true);
  });

  test('should remove toast by id', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    let toastId: string;

    act(() => {
      toastId = result.current.showInfo('Test message');
    });

    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      result.current.removeToast(toastId);
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  test('should clear all toasts', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    act(() => {
      result.current.showInfo('Message 1');
      result.current.showInfo('Message 2');
      result.current.showInfo('Message 3');
    });

    expect(result.current.toasts).toHaveLength(3);

    act(() => {
      result.current.clearAllToasts();
    });

    expect(result.current.toasts).toHaveLength(0);
  });

  test('should generate unique IDs for toasts', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    let id1 = '';
    let id2 = '';

    act(() => {
      id1 = result.current.showInfo('Message 1');
      id2 = result.current.showInfo('Message 2');
    });

    expect(id1).not.toBe(id2);
    expect(result.current.toasts[0].id).toBe(id2); // Newest first
    expect(result.current.toasts[1].id).toBe(id1);
  });

  test('should return toast ID when creating toast', () => {
    const { result } = renderHook(() => useToast(), {
      wrapper: ToastProvider,
    });

    let toastId = '';

    act(() => {
      toastId = result.current.showSuccess('Test message');
    });

    expect(typeof toastId).toBe('string');
    expect(toastId).toMatch(/^toast_\d+_[a-z0-9]+$/);
    expect(result.current.toasts[0].id).toBe(toastId);
  });
}); 