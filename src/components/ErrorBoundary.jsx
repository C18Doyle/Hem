import { Component } from "react";
import { logClientError } from "../lib/errors.js";

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { logClientError(error.message, { stack: error.stack?.slice(0, 1500), component: info.componentStack?.slice(0, 800) }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <h2>Something broke on this screen</h2>
        <p className="lede">It’s been logged in Settings, under Errors.</p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>);
  }
}
