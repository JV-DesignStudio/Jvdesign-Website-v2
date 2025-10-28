import React from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/index';
import About from './pages/about';
import Projects from './pages/projects';
import './styles/globals.css';

const App: React.FC = () => {
    return (
        <Router>
            <Header />
            <Switch>
                <Route path="/" exact component={Home} />
                <Route path="/about" component={About} />
                <Route path="/projects" component={Projects} />
            </Switch>
            <Footer />
        </Router>
    );
};

export default App;