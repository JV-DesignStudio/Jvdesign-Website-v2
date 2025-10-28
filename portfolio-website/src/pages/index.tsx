import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Home: React.FC = () => {
    return (
        <div>
            <Header />
            <main className="flex flex-col items-center justify-center min-h-screen">
                <h1 className="text-4xl font-bold">Welcome to My Portfolio</h1>
                <p className="mt-4 text-lg">Explore my projects and learn more about me.</p>
            </main>
            <Footer />
        </div>
    );
};

export default Home;