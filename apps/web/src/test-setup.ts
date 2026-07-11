import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';
import i18n from './i18n';

expect.extend(matchers);

// Deterministic UI strings for tests (fallbackLng is vi).
void i18n.changeLanguage('vi');
