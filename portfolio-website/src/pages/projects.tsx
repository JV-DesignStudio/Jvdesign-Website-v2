import React from 'react';
import ProjectCard from '../components/ProjectCard';
import projectsData from '../data/projects';

const Projects: React.FC = () => {
    return (
        <div className="projects-container">
            <h1 className="text-3xl font-bold mb-6">My Projects</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projectsData.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                ))}
            </div>
        </div>
    );
};

export default Projects;