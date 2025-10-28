import React from 'react';
import { Link } from 'react-router-dom';

const Header: React.FC = () => {
    return (
        <header className="bg-gray-800 text-white p-4">
            <div className="container mx-auto flex justify-between items-center">
                <h1 className="text-2xl font-bold">
                    My Portfolio
                </h1>
                <nav>
                    <ul className="flex space-x-4">
                        <li>
                            <Link to="/" className="hover:text-gray-400">Home</Link>
                        </li>
                        <li>
                            <Link to="/about" className="hover:text-gray-400">About</Link>
                        </li>
                        <li>
                            <Link to="/projects" className="hover:text-gray-400">Projects</Link>
                        </li>
                    </ul>
                </nav>
            </div>
        </header>
    );
};

export default Header;