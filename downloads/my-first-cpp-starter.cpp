// My First C++ Game: Star Catcher starter (SFML)
// Build with your usual SFML setup, then work through the canvas steps.
#include <SFML/Graphics.hpp>

int main() {
    sf::RenderWindow window(sf::VideoMode(800, 600), "Star Catcher");

    sf::RectangleShape catcher(sf::Vector2f(100.f, 20.f));
    catcher.setPosition(350.f, 550.f);
    catcher.setFillColor(sf::Color(80, 140, 255));

    sf::CircleShape star(12.f);
    star.setPosition(390.f, 40.f);
    star.setFillColor(sf::Color(255, 210, 60));

    int score = 0;
    int lives = 3;

    while (window.isOpen()) {
        sf::Event event;
        while (window.pollEvent(event)) {
            if (event.type == sf::Event::Closed) window.close();
        }

        // Step 2: move the catcher with the arrow keys or A/D, then clamp it.
        // Step 3: move the star down and respawn it at the top.
        // Step 4: check the catcher and star rectangles for a catch or a miss.
        // Step 5: draw the score and lives, and end the game at zero lives.
        // Step 6: add a high score, a speed ramp and R to restart.

        window.clear(sf::Color(20, 22, 30));
        window.draw(catcher);
        window.draw(star);
        window.display();
    }
    return 0;
}
