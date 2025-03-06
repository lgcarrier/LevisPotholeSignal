function TravelControl({ isTraveling, onToggle }) {
    return (
      <button
        onClick={onToggle}
        className={`travel-button ${isTraveling ? 'stop' : 'start'}`}
      >
        {isTraveling ? 'End Travel' : 'Start Travel'}
      </button>
    )
  }
  
  export default TravelControl