import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button, type ButtonVariant, type ButtonSize } from './Button';

describe('Button Component', () => {
  test('should render with default props', () => {
    render(<Button>Click me</Button>);
    
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-gradient-to-r from-pink-500 to-purple-600');
    expect(button).toHaveClass('px-4 py-2 text-base');
  });

  test('should render with different variants', () => {
    const variants: ButtonVariant[] = ['primary', 'secondary', 'success', 'danger', 'ghost'];
    
    variants.forEach((variant) => {
      const { unmount } = render(<Button variant={variant}>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      
      unmount();
    });
  });

  test('should render with different sizes', () => {
    const sizes: ButtonSize[] = ['sm', 'md', 'lg'];
    
    sizes.forEach((size) => {
      const { unmount } = render(<Button size={size}>Button</Button>);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      
      unmount();
    });
  });

  test('should show loading state', () => {
    render(<Button loading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  test('should be disabled when loading', () => {
    render(<Button loading>Loading</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  test('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  test('should not handle click when disabled', () => {
    const handleClick = vi.fn();
    render(<Button disabled onClick={handleClick}>Disabled</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('should not handle click when loading', () => {
    const handleClick = vi.fn();
    render(<Button loading onClick={handleClick}>Loading</Button>);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  test('should apply custom className', () => {
    render(<Button className="custom-class">Button</Button>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  test('should have proper accessibility attributes', () => {
    render(<Button aria-label="Custom button">Button</Button>);
    
    const button = screen.getByRole('button', { name: 'Custom button' });
    expect(button).toBeInTheDocument();
  });
}); 