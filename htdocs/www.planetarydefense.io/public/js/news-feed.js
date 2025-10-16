document.addEventListener('DOMContentLoaded', function() {
    fetch('/mission/news-feed')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            const newsFeedDiv = document.getElementById('news-feed-text-div');
            newsFeedDiv.innerHTML = ''; // Clear existing content

            if (data.length === 0) {
                newsFeedDiv.innerHTML = '<p id="news-feed-text" class="mb-2 text-center">No news available.</p>';
            } else {
                data.forEach(news => {
                    const newsItem = document.createElement('p');
                    newsItem.id = 'news-feed-text';
                    newsItem.classList.add('mb-2', 'text-center'); // Add classes here
                    newsItem.innerHTML = news.newsfeed; // Assuming newsfeed contains the HTML content
                    newsFeedDiv.appendChild(newsItem);
                });
            }
        })
        .catch(error => {
            console.error('Erreur lors de la récupération des news:', error);
            const newsFeedDiv = document.getElementById('news-feed-text-div');
            newsFeedDiv.innerHTML = '<p id="news-feed-text" class="mb-2 text-center">Erreur lors de la récupération des news.</p>';
        });
});