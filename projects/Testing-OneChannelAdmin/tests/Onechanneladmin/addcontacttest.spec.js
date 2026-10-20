import { test, expect } from '@playwright/test';
import { loginOneChannelAdmin } from './loginSteps.js';

test('test', async ({ page }) => {
  await loginOneChannelAdmin(page);
  await page.getByRole('button', { name: 'CRM' }).click();
  await page.getByRole('link', { name: 'B2B Accounts' }).click();
  await page.getByRole('tab', { name: 'Contacts' }).click();
  await page.getByRole('button', { name: ' Contacts' }).click();
  await page.getByRole('textbox', { name: 'First Name *' }).click();
  await page.getByRole('textbox', { name: 'First Name *' }).fill('testemailtocheck@gmail.com');
  await page.getByRole('textbox', { name: 'Enter First Name' }).click();
  await page.getByRole('textbox', { name: 'Enter First Name' }).fill('test name');
  await page.getByRole('textbox', { name: 'Enter Last Name' }).click();
  await page.getByRole('textbox', { name: 'Enter First Name' }).fill('test namelast ');
  await page.getByRole('textbox', { name: 'Enter Last Name' }).fill('last name');
  await page.getByRole('textbox', { name: 'Enter First Name' }).click();
  await page.getByRole('textbox', { name: 'Enter First Name' }).fill('test name');
  await page.getByRole('textbox', { name: 'Enter Website' }).click();
  await page.getByRole('textbox', { name: 'Enter Website' }).fill('test');
  await page.locator('div').filter({ hasText: 'empty' }).nth(5).click();
  await page.getByRole('option', { name: 'CEO' }).click();
  await page.getByRole('option', { name: 'CEO' }).click();
  await page.getByRole('textbox', { name: 'Address line', exact: true }).click();
  await page.getByRole('textbox', { name: 'Address line', exact: true }).fill('test');
  await page.getByRole('button', { name: ' Submit' }).click();
  await page.getByText('User created').click();
});