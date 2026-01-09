import './Sidebar.css'

export type ViewType = 'today' | 'stats' | 'settings'

interface NavItem {
  id: ViewType
  icon: string
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'today', icon: '🏠', label: 'Today' },
  { id: 'stats', icon: '📊', label: 'Stats' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

interface SidebarProps {
  currentView: ViewType
  onNavigate: (view: ViewType) => void
}

export function Sidebar({ currentView, onNavigate }: SidebarProps) {
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo">💧</span>
      </div>
      
      <ul className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`sidebar__item ${currentView === item.id ? 'sidebar__item--active' : ''}`}
              onClick={() => onNavigate(item.id)}
              title={item.label}
            >
              <span className="sidebar__icon">{item.icon}</span>
              <span className="sidebar__label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="sidebar__spacer" />
      
      <div className="sidebar__footer">
        <span className="sidebar__version">v0.1</span>
      </div>
    </nav>
  )
}
