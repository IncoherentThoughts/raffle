import logo from '../assets/logo-white.svg'

export function HeaderBar() {
  return (
    <header className="header-bar">
      <div className="header-bar__inner">
        <img src={logo} alt="The Comfort Group" />
        <span className="header-bar__title">Company Raffle</span>
      </div>
    </header>
  )
}
