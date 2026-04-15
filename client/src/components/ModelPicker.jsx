import React from 'react';

let styles = {};

styles.picker = {
  position: 'relative',
  display: 'flex',
  height: '180px',
  background: 'rgba(15, 23, 42, 0.95)',
  backdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
};
styles.categoryList = {
  width: '180px',
  overflowY: 'auto',
  overflowX: 'hidden',
  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
};
styles.categoryItem = {
  padding: '10px 15px',
  cursor: 'pointer',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '0.85em',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
  transition: 'all 0.2s',
};
styles.categoryItemActive = {
  padding: '10px 15px',
  cursor: 'pointer',
  color: '#FFFFFF',
  fontSize: '0.85em',
  backgroundColor: 'rgba(96, 165, 250, 0.2)',
  borderLeft: '3px solid #60a5fa',
  borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
};
styles.partsGrid = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '10px',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: '12px',
  alignContent: 'start',
};
styles.modelCard = {
  cursor: 'pointer',
  background: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '8px',
  padding: '8px',
  transition: 'all 0.2s',
  border: '1px solid transparent',
};
styles.modelCardHover = {
  background: 'rgba(255, 255, 255, 0.1)',
  borderColor: 'rgba(96, 165, 250, 0.5)',
};
styles.modelImage = {
  width: '100%',
  height: '120px',
  objectFit: 'contain',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  borderRadius: '4px',
  marginBottom: '6px',
};
styles.modelName = {
  color: '#FFFFFF',
  fontSize: '0.75em',
  textAlign: 'center',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
styles.modelMeta = {
  color: 'rgba(255, 255, 255, 0.5)',
  fontSize: '0.65em',
  textAlign: 'center',
  marginTop: '2px',
};

class ModelPicker extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      models: [],
      categories: ['All', 'By Theme', 'By Year', 'By Size'],
      selectedCategory: 'All',
      loading: true,
      filterYear: null,
      filterTheme: null,
    };
  }

  componentDidMount() {
    this.loadModels();
  }

  loadModels = async () => {
    try {
      const response = await fetch('/api/models/list');
      if (response.ok) {
        const data = await response.json();
        this.setState({ 
          models: data.models || [],
          loading: false 
        });
      }
    } catch (err) {
      console.error('Failed to load models:', err);
      this.setState({ loading: false });
    }
  };

  getFilteredModels = () => {
    const { models, selectedCategory, filterYear, filterTheme } = this.state;
    
    let filtered = [...models];
    
    if (selectedCategory === 'By Year' && filterYear) {
      filtered = filtered.filter(m => m.year === filterYear);
    } else if (selectedCategory === 'By Theme' && filterTheme) {
      filtered = filtered.filter(m => m.theme === filterTheme);
    } else if (selectedCategory === 'By Size') {
      // Sort by piece count
      filtered.sort((a, b) => (a.pieces || 0) - (b.pieces || 0));
    }
    
    return filtered;
  };

  handleModelClick = (model) => {
    const { onSelectModel } = this.props;
    if (onSelectModel) {
      onSelectModel(model);
    }
  };

  render() {
    const { selectedCategory, loading } = this.state;
    const filteredModels = this.getFilteredModels();

    if (loading) {
      return (
        <div style={styles.picker}>
          <div style={{ ...styles.partsGrid, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
            Loading models...
          </div>
        </div>
      );
    }

    const years = [...new Set(this.state.models.map(m => m.year).filter(Boolean))].sort((a, b) => b - a);
    const themes = [...new Set(this.state.models.map(m => m.theme).filter(Boolean))].sort();

    return (
      <div style={styles.picker}>
        <div style={styles.categoryList}>
          {this.state.categories.map((cat) => (
            <div
              key={cat}
              onClick={() => this.setState({ selectedCategory: cat })}
              style={selectedCategory === cat ? styles.categoryItemActive : styles.categoryItem}
              onMouseEnter={(e) => {
                if (selectedCategory !== cat) {
                  e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory !== cat) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              {cat}
            </div>
          ))}
          {selectedCategory === 'By Year' && years.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', paddingTop: '8px' }}>
              {years.slice(0, 10).map(year => (
                <div
                  key={year}
                  onClick={() => this.setState({ filterYear: this.state.filterYear === year ? null : year })}
                  style={{
                    ...styles.categoryItem,
                    paddingLeft: '25px',
                    backgroundColor: this.state.filterYear === year ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                  }}
                >
                  {year}
                </div>
              ))}
            </div>
          )}
          {selectedCategory === 'By Theme' && themes.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '8px', paddingTop: '8px' }}>
              {themes.slice(0, 15).map(theme => (
                <div
                  key={theme}
                  onClick={() => this.setState({ filterTheme: this.state.filterTheme === theme ? null : theme })}
                  style={{
                    ...styles.categoryItem,
                    paddingLeft: '25px',
                    fontSize: '0.75em',
                    backgroundColor: this.state.filterTheme === theme ? 'rgba(96, 165, 250, 0.15)' : 'transparent',
                  }}
                >
                  {theme}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={styles.partsGrid}>
          {filteredModels.map((model) => (
            <div
              key={model.id || model.name}
              style={styles.modelCard}
              onClick={() => this.handleModelClick(model)}
              onMouseEnter={(e) => {
                Object.assign(e.currentTarget.style, styles.modelCardHover);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = styles.modelCard.background;
                e.currentTarget.style.borderColor = styles.modelCard.border;
              }}
            >
              {model.image ? (
                <img src={model.image} alt={model.name} style={styles.modelImage} />
              ) : (
                <div style={{ ...styles.modelImage, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: '2em' }}>
                  ?
                </div>
              )}
              <div style={styles.modelName} title={model.name}>
                {model.name}
              </div>
              <div style={styles.modelMeta}>
                {model.pieces ? `${model.pieces} pcs` : ''} {model.year ? `• ${model.year}` : ''}
              </div>
            </div>
          ))}
          {filteredModels.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '40px' }}>
              No models found
            </div>
          )}
        </div>
      </div>
    );
  }
}

export default ModelPicker;