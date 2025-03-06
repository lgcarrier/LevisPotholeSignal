function TravelControl({ isTraveling, onToggle }) {
    return (
      <button
      onClick={onToggle}
      className={`travel-button ${isTraveling ? 'stop' : 'start'}`}
      >
      {isTraveling ? 'Arrêter le parcours' : 'Démarrer le parcours'}
      </button>
    )
  }
  
  export default TravelControl