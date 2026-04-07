import React from 'react';
import ReactDOM from 'react-dom';
import ColorPicker from './ColorPicker';


let styles = {};

styles.sidebar = {
  position: 'absolute',
  top: '100%',
  right: '0',
  background: '#22386E',
  height: 'calc(100vh - 100%)',
  boxShadow: 'inset -2px -2px 3px rgba(0, 0, 0, 0.25), inset 2px -2px 3px rgba(0, 0, 0, 0.25)',
  transform: 'translateX(100%)',
  transition: 'all 0.15s ease-in-out',
}
styles.visible = {
  composes: 'sidebar',
  position: 'absolute',
  top: '100%',
  right: '0',
  background: 'rgba(15, 23, 42, 0.95)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  height: 'calc(100vh - 100%)',
  borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
  boxShadow: '-4px 0 6px -1px rgba(0, 0, 0, 0.3)',
  transition: 'all 0.2s ease',
  transform: 'translateX(0)',
  width: '280px',
  overflowX: 'hidden',
}
styles.modalOverlay = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  zIndex: 2147483647,
  paddingTop: '10vh',
  overflowY: 'auto',
}
styles.modal = {
  backgroundColor: '#22386E',
  borderRadius: '8px',
  padding: '20px',
  minWidth: '400px',
  maxWidth: '600px',
  maxHeight: '80vh',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
  color: '#FFFFFF',
}
styles.modalHeader = {
  fontSize: '1.2em',
  fontWeight: 'bold',
  marginBottom: '15px',
  borderBottom: '1px solid #334466',
  paddingBottom: '10px',
}
styles.modalContent = {
  marginBottom: '15px',
  maxHeight: '400px',
  overflowY: 'auto',
}
styles.modalFooter = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
  borderTop: '1px solid #334466',
  paddingTop: '15px',
}
styles.separator = {
  position: 'relative',
  height: '10px',
  background: '#A0CCFF',
  width: '100%',
  marginBottom: '7.5px',
}
styles.content = {
  padding: '6px 8px',
}
styles.row = {
  margin: '4px 0',
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: '0.9em',
  transition: 'all 0.2s ease',
  padding: '10px 14px',
  borderRadius: '8px',
  cursor: 'pointer',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
}
styles.rowHover = {
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  transform: 'translateX(-2px)',
}
styles.row.hover = {
  color: '#A0CCFF',
}
styles.text = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
}
styles.text.i = {
  marginRight: '10px',
}


const SidebarButton = ({ icon, text, onClick, children }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  return (
    <div 
      style={isHovered ? { ...styles.row, ...styles.rowHover } : styles.row}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={styles.text}>
        {icon && <ion-icon name={icon} style={{ marginRight: '10px', fontSize: '1.2em' }}></ion-icon>}
        <span>{text}</span>
        {children}
      </div>
    </div>
  );
};

class Sidebar extends React.Component {
  state = {
    showSceneDialog: false,
    sceneDialogMode: 'save', // 'save' or 'load'
    saveName: '',
    scenes: [],
  };

  componentDidMount() {
    this.loadScenesList();
    document.addEventListener('keydown', this.handleKeyDown);
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  handleKeyDown = (e) => {
    if (e.key === 'Escape' && this.state.showSceneDialog) {
      this.setState({ showSceneDialog: false, saveName: '' });
    }
  };

  loadScenesList = async () => {
    try {
      const res = await fetch('/api/scenes/list');
      const data = await res.json();
      this.setState({ scenes: data.scenes || [] });
    } catch (err) {
      console.error('Failed to load scenes:', err);
    }
  };

  handleSave = async () => {
    const { saveName } = this.state;
    if (!saveName.trim()) return;
    
    try {
      const res = await fetch('/api/scenes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName }),
      });
      if (res.ok) {
        this.setState({ showSceneDialog: false, saveName: '' });
        this.loadScenesList();
      }
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save scene');
    }
  };

  handleLoad = async (sceneName) => {
    if (!confirm(`Load scene "${sceneName}"? This will replace the current scene.`)) return;
    
    try {
      const res = await fetch(`/api/scenes/load/${encodeURIComponent(sceneName)}`);
      if (res.ok) {
        // Trigger a page reload to get the new scene
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to load:', err);
      alert('Failed to load scene');
    }
  };

  handleReset = async () => {
    if (confirm('Reset scene? This will delete all bricks and cannot be undone.')) {
      try {
        // Send reset to server via WebSocket (through the Scene component's mechanism)
        // For now, just reload which will fetch the empty scene
        const response = await fetch('/api/reset', { method: 'POST' });
        if (response.ok) {
          window.location.reload();
        }
      } catch (err) {
        // Fallback: just reload, server will have empty world
        window.location.reload();
      }
    }
  };

  render() {
    const { resetScene, color, onClickSetColor } = this.props;
    const { showSceneDialog, sceneDialogMode, saveName, scenes } = this.state;
    
    return (
      <>
        <div style={styles.visible}>
          <div style={styles.content}>
            <div style={{ padding: '8px 4px 4px 4px' }}>
              <div style={{ fontWeight: '600', fontSize: '0.75em', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255, 255, 255, 0.9)', marginBottom: '8px', paddingLeft: '4px' }}>Materials</div>
              <div style={{ marginLeft: '20px' }}>
                <ColorPicker color={color} handleSetColor={onClickSetColor} />
              </div>
            </div>
          </div>

          <div style={styles.content}>
            <SidebarButton icon="save-outline" text="Save Scene" onClick={() => this.setState({ showSceneDialog: true, sceneDialogMode: 'save', saveName: '' })} />
          </div>

          <div style={styles.content}>
            <SidebarButton icon="folder-open-outline" text={`Load Scene (${scenes.length})`} onClick={() => this.setState({ showSceneDialog: true, sceneDialogMode: 'load' })} />
          </div>

          <div style={styles.content}>
            <SidebarButton icon="trash-outline" text="Reset Scene" onClick={this.handleReset} />
          </div>
        </div>

        {showSceneDialog && ReactDOM.createPortal(
          <div style={styles.modalOverlay} onClick={() => this.setState({ showSceneDialog: false, saveName: '' })}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>{sceneDialogMode === 'save' ? 'Save Scene' : 'Load Scene'}</div>
              <div style={styles.modalContent}>
                {sceneDialogMode === 'save' && (
                  <>
                    <div style={{ marginBottom: '12px' }}>
                      <input
                        type="text"
                        placeholder="Enter new scene name..."
                        value={saveName}
                        onChange={(e) => this.setState({ saveName: e.target.value })}
                        onKeyPress={(e) => e.key === 'Enter' && this.handleSave()}
                        style={{ width: '100%', padding: '8px', fontSize: '14px', backgroundColor: '#1a2a4a', color: '#FFF', border: '1px solid #334466', borderRadius: '4px' }}
                        autoFocus
                      />
                    </div>
                    {scenes.length > 0 && (
                      <>
                        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85em', marginBottom: '8px' }}>Or overwrite existing:</div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                          {scenes.map((scene) => (
                            <div key={scene.filename} style={{ padding: '8px', marginBottom: '4px', backgroundColor: saveName === scene.name ? 'rgba(96, 165, 250, 0.3)' : 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(255, 255, 255, 0.1)' }} onClick={() => this.setState({ saveName: scene.name })}>
                              <div style={{ fontWeight: '500' }}>{scene.name}</div>
                              <div style={{ fontSize: '0.75em', color: 'rgba(255, 255, 255, 0.6)' }}>{scene.numberBricks} bricks</div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                {sceneDialogMode === 'load' && (
                  <>
                    {scenes.length === 0 ? (
                      <div style={{ color: '#A0CCFF', textAlign: 'center', padding: '20px' }}>No saved scenes</div>
                    ) : (
                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {scenes.map((scene) => (
                          <div key={scene.filename} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', marginBottom: '8px', backgroundColor: '#1a2a4a', borderRadius: '4px', cursor: 'pointer' }} onClick={() => this.handleLoad(scene.filename)}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{scene.name}</div>
                              <div style={{ fontSize: '0.85em', color: '#A0CCFF' }}>{scene.numberBricks} bricks • {new Date(scene.savedAt).toLocaleString()}</div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); this.handleDelete(scene.filename); }} style={{ padding: '4px 8px', backgroundColor: '#663333', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '10px' }}>Delete</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={styles.modalFooter}>
                <button onClick={() => this.setState({ showSceneDialog: false, saveName: '' })} style={{ padding: '8px 16px', backgroundColor: '#334466', color: '#FFF', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{sceneDialogMode === 'save' ? 'Cancel' : 'Close'}</button>
                {sceneDialogMode === 'save' && (
                  <button onClick={this.handleSave} disabled={!saveName.trim()} style={{ padding: '8px 16px', backgroundColor: saveName.trim() ? '#4a6fa5' : '#334466', color: '#FFF', border: 'none', borderRadius: '4px', cursor: saveName.trim() ? 'pointer' : 'not-allowed', opacity: saveName.trim() ? 1 : 0.5 }}>Save</button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }
}


export default Sidebar;
