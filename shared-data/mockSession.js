export const mockUsers = [
  { id: 'john', email: 'john@fieldflow.demo', password: 'john-demo-password', account_id: 'acct_northstar', name: 'John', role: 'owner' },
  { id: 'sarah', email: 'sarah@fieldflow.demo', password: 'sarah-demo-password', account_id: 'acct_horizon', name: 'Sarah', role: 'owner' },
  { id: 'ops', email: 'ops@fieldflow.demo', password: 'ops-demo-password', name: 'FieldFlow Operations', role: 'ops' },
];

export function authenticateMockUser(email, password) {
  const user = mockUsers.find((candidate) => candidate.email === email.trim().toLowerCase() && candidate.password === password);
  if (!user) throw new Error('Use one of the demo accounts shown below.');
  return { id: user.id, email: user.email, account_id: user.account_id, name: user.name, role: user.role };
}

export function mockUserFromSearch(search) {
  const params = new URLSearchParams(search);
  const userId = params.get('demo_user');
  const user = mockUsers.find((candidate) => candidate.id === userId);
  if (user) return { id: user.id, email: user.email, account_id: user.account_id, name: user.name, role: user.role };
  if (userId !== 'new') return null;
  const name = params.get('demo_name');
  const email = params.get('demo_email');
  const companyName = params.get('demo_company');
  const accountId = params.get('account_id');
  return name && email && companyName && /^acct_demo_[a-z0-9-]+$/.test(accountId ?? '')
    ? { id: 'new', email, account_id: accountId, name, role: 'owner', company_name: companyName }
    : null;
}

export function isMockContractor(user) {
  return Boolean(user && user.role !== 'ops' && user.account_id);
}

export function createMockAccount({ companyName, ownerName, email }) {
  const name = typeof ownerName === 'string' ? ownerName.trim() : '';
  const company = typeof companyName === 'string' ? companyName.trim() : '';
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!name || !company || !normalizedEmail) throw new Error('Enter your name, business name, and email address.');
  const slug = `${company}-${normalizedEmail}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return { id: 'new', email: normalizedEmail, account_id: `acct_demo_${slug}`, name, role: 'owner', company_name: company };
}

export function buildMockAppLink(baseUrl, user) {
  if (!isMockContractor(user)) {
    throw new Error('Only contractor demo accounts can open contractor tools.');
  }
  const url = new URL(baseUrl);
  url.searchParams.set('demo_user', user.id);
  url.searchParams.set('account_id', user.account_id);
  if (user.company_name) {
    url.searchParams.set('demo_name', user.name);
    url.searchParams.set('demo_email', user.email);
    url.searchParams.set('demo_company', user.company_name);
  }
  return url.toString();
}
