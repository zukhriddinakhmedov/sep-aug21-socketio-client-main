import { Container, Row, Col, Form, FormControl, ListGroup, ListGroupItem, Button } from 'react-bootstrap'
import { useState, useEffect, FormEvent } from 'react'
import { io } from 'socket.io-client'
import { IUser } from '../interfaces/IUser'
import IMessage from '../interfaces/IMessage'
import { Room } from '../interfaces/Room'

const ADDRESS = 'http://localhost:3030' // <-- address of the BACKEND PROCESS
const socket = io(ADDRESS, { transports: ['websocket'] })
// io establishes a connection with our backend socket.io process
// it takes the address we want to connect to, and optionally a configuration object
// in which we're asking to use straight the websocket protocol
// io returns the created connection (which is called "Socket")
// and we're assigning it to a variable because we're going to leverage
// methods and properties of this connection reference for listening to and emitting events
// EVERYTHING WE'RE GONNA DO IS GOING TO BE EVENT-BASED

// the second argument of io is for "connection options"
// transports is a property that will set which TECHNOLOGIES are we going to enable
// in our socket. By default the value of trasports is ["polling", "websocket"]

// CHAIN OF EVENTS/OPERATIONS:
// 1) CONNECT TO THE SERVER
// 2) SET YOUR USERNAME
// 3) BE NOTIFIED WHEN ANOTHER USER CONNECTS
// 4) ...send messages!

const Home = () => {
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<IUser[]>([])
  const [chatHistory, setChatHistory] = useState<IMessage[]>([])

  // every time this component renders, a connection gets established to the server
  // thanks to the io invocation at line 6

  // for checking the established connection, we can listen to an event coming from the server
  // because the server is told to emit a "welcome" event every time a client connects

  // how can we listen for an event coming from the server?
  // setting up a TRAP! (an event listener)

  useEffect(() => {
    // here we're setting up the traps, just once, because once set up they'll continue
    // working until the component is unmounted
    //
    // this trap is for the "connect" event coming from the server
    // the server is told to emit a "connect" event every time a new client connects

    socket.on('connect', () => {
      // we can listen here and execute code whenever a "connect" event comes towards our way!
      console.log('Connection established!')
    })

    // ONE TIME EXECUTED FUNCTION

    // now our client is able to successfully connect to the server. What's next?
    // now once we're connected, we can SET OUR USERNAME.

    // when the username is set, the backend will send me a "loggedin" event
    // let's set up a trap for it:
    socket.on('loggedin', () => {
      console.log("you're logged in!")
      // well done! let's set our interface as "logged in"
      setLoggedIn(true)
      // now it would be nice to populate the connected users list...
      fetchOnlineUsers()

      // when a user succesfully sets his/her username, he receives a loggedin event
      // but the server is also going another cool thing! to all the OTHER connected clients,
      // they will be notified as well! they're going to receive ANOTHER event, called: "newConnection"
      // "newConnection" is sent by the server as BROADCAST
      // it means "newConnection" is sent to all the clients BUT the one who just connected
      // so we should set up an event listener also for "newConnection", and in there
      // we should call AGAIN the fetchOnlineUsers()
      socket.on('newConnection', () => {

        console.log('watch out! a new challenger appears!')
        // this is for an "old" user which has to be notified about a new user entering the chat
        // let's re-fetch the list of online users:
        fetchOnlineUsers()
      })
    })

    socket.on('message', (newMessage: IMessage) => {
      console.log('a new message appeared!')
      // this is for the other connected clients when a user is sending a message
      // this should append the new message that has just been sent from someone else
      // on THEIR chat history!
      // let's append it!
      //   setChatHistory([...chatHistory, newMessage]) // <-- kinda buggy, because the value of
      // chatHistory is always going to be an empty array (that's the evaluated value when
      // the useEffect hook executes)
      setChatHistory((chatHistory) => [...chatHistory, newMessage])
    })
  }, [])

  const handleUsernameSubmit = (e: FormEvent) => {
    e.preventDefault()
    // from here I want to send my username to the server
    // if "on()" on socket is for LISTENING for events, "emit()" is for SENDING an event
    socket.emit('setUsername', { username: username, room: room })
    // every time the server receives a username, it sends BACK an event to the client!
    // and that event is called "loggedin"
  }

  const handleMessageSubmit = (e: FormEvent) => {
    e.preventDefault()

    const newMessage: IMessage = {
      text: message,
      sender: username,
      socketId: socket.id,
      timestamp: Date.now(), // <-- ms expired 01/01/1970
    }

    socket.emit('sendmessage', { message: newMessage, room: room })
    // this is sending my message to the server. I'm not receiving back my own message,
    // so I need to append it manually to my chat history.
    // but all the other connected clients are going to receive it back from the server!
    // the server is bouncing the message back to all the other clients in an event!
    // and that event is called 'message'...
    // let's set up a trap (event listener) for catching all the 'message' events
    // that all the other clients are going to receive!
    setChatHistory([...chatHistory, newMessage])
    setMessage('')
  }

  const fetchOnlineUsers = async () => {
    try {
      let response = await fetch(ADDRESS + '/online-users')
      if (response) {
        let data: { onlineUsers: IUser[] } = await response.json()
        // data is an array with all the current connected users
        setOnlineUsers(data.onlineUsers)
      } else {
        console.log('error fetching the online users')
      }
    } catch (error) {
      console.log(error)
    }
  }

  const [room, setRoom] = useState<Room>('blue')

  return (
    <Container fluid className='px-4'>
      <Row className='my-3' style={{ height: '95vh' }}>
        <Col md={10} className='d-flex flex-column justify-content-between'>
          {/* for the main chat window */}
          {/* 3 parts: username input, chat history, new message input */}
          {/* TOP SECTION: USERNAME INPUT FIELD */}
          <Form onSubmit={handleUsernameSubmit} className="d-flex">
            <FormControl
              placeholder='Insert your username'
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loggedIn}
            />
            <Button
              className="ml-2"
              variant={room === "blue" ? "primary" : "danger"}
              onClick={() => setRoom(room === "blue" ? "red" : "blue")}
            >Room</Button>
          </Form>
          {/* MIDDLE SECTION: CHAT HISTORY */}
          <ListGroup>
            {chatHistory.map((message, i) => (
              <ListGroupItem key={i}>
                <strong>{message.sender}</strong>
                <span className='mx-1'> | </span>
                <span>{message.text}</span>
                <span className='ml-2' style={{ fontSize: '0.7rem' }}>
                  {new Date(message.timestamp).toLocaleTimeString('en-US')}
                </span>
              </ListGroupItem>
            ))}
          </ListGroup>
          {/* BOTTOM SECTION: NEW MESSAGE INPUT FIELD */}
          <Form onSubmit={handleMessageSubmit}>
            <FormControl
              placeholder='Insert your message here'
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={!loggedIn}
            />
          </Form>
        </Col>
        <Col md={2} style={{ borderLeft: '2px solid black' }}>
          {/* for the currently connected clients */}
          <div className='mb-3'>Connected users:</div>
          <ListGroup>
            {onlineUsers.length === 0 && <ListGroupItem>No users yet!</ListGroupItem>}
            {onlineUsers.filter(user => user.room === room).map((user) => (
              <ListGroupItem key={user.id}>{user.username}</ListGroupItem>
            ))}
          </ListGroup>
        </Col>
      </Row>
    </Container>
  )
}

export default Home
