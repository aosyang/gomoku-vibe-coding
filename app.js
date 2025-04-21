// 游戏常量
const BOARD_SIZE = 15;
const WINNING_COUNT = 5;

// DOM 元素
const usernameInput = document.getElementById('username');
const createBtn = document.getElementById('create-btn');
const joinBtn = document.getElementById('join-btn');
const connectionInfo = document.getElementById('connection-info');
const connectionIdSpan = document.getElementById('connection-id');
const copyIdBtn = document.getElementById('copy-id');
const remoteIdInput = document.getElementById('remote-id');
const statusMessage = document.getElementById('status-message');
const setupPanel = document.querySelector('.setup-panel');
const gameContainer = document.getElementById('game-container');
const board = document.getElementById('board');
const localPlayerName = document.getElementById('local-player-name');
const localPlayerPiece = document.getElementById('local-player-piece');
const remotePlayerName = document.getElementById('remote-player-name');
const remotePlayerPiece = document.getElementById('remote-player-piece');
const turnIndicator = document.getElementById('turn-indicator');
const restartBtn = document.getElementById('restart-btn');
const leaveBtn = document.getElementById('leave-btn');
const winOverlay = document.getElementById('win-overlay');
const winMessage = document.getElementById('win-message');
const newGameBtn = document.getElementById('new-game-btn');
const toggleWinOverlayBtn = document.getElementById('toggle-win-overlay-btn');

// 用于临时保存虚影显示的变量
let previewPiece = null;
let lastMouseOverCell = null;

// 游戏状态
let gameState = {
    board: Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null)),
    currentPlayer: 'black',
    myPiece: null,
    myTurn: false,
    username: '',
    remoteUsername: '',
    gameActive: false,
    gameOver: false,
    winner: null,
    isCreator: undefined,
    winningCells: [] // 存储获胜的5个棋子位置
};

// P2P 连接变量
let peer = null;
let conn = null;
let peerId = null;

// 加载保存的用户名
function loadUsername() {
    const savedUsername = localStorage.getItem('gomoku_username');
    if (savedUsername) {
        usernameInput.value = savedUsername;
    }
}

// 保存用户名到本地存储
function saveUsername(username) {
    localStorage.setItem('gomoku_username', username);
}

// 初始化PeerJS
function initializePeer() {
    if (peer) {
        peer.destroy();
    }
    
    // 使用Google的STUN服务器
    peer = new Peer({
        config: {
            'iceServers': [
                { urls: 'stun:stun.l.google.com:19302' }
            ]
        },
        debug: 3 // 增加调试级别
    });

    peer.on('open', id => {
        peerId = id;
        connectionIdSpan.textContent = id;
        createBtn.disabled = false;
        console.log('已连接到STUN服务器，我的ID是:', id);
        updateStatus('已连接到STUN服务器，您可以创建游戏或加入游戏');
    });

    peer.on('connection', connection => {
        if (conn) {
            // 已经有连接，拒绝新的连接
            connection.close();
            return;
        }
        
        conn = connection;
        // 当收到连接时，这个人是创建者
        if (!conn.metadata) {
            conn.metadata = {};
        }
        conn.metadata.isCreator = true; // 标记我是游戏创建者
        
        setupConnection();
    });

    peer.on('error', err => {
        console.error('Peer连接错误:', err);
        updateStatus(`连接错误: ${err.message || err}`);
    });
}

// 设置数据连接
function setupConnection() {
    conn.on('open', () => {
        updateStatus('已连接到对手');
        setupPanel.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        
        // 发送用户名
        sendData({
            type: 'username',
            username: gameState.username
        });
        
        // 决定谁先手(创建游戏的人是黑棋，先手)
        if (!conn.metadata) {
            conn.metadata = {};
        }
        
        // 如果是通过创建游戏按钮创建的，或者收到别人的连接请求，都认为是创建者（黑棋）
        const isCreator = conn.metadata.isCreator || (conn.metadata && conn.metadata.initiator);
        
        if (isCreator) {
            gameState.myPiece = 'black';
            gameState.myTurn = true;
            console.log('我是创建者，使用黑棋先行');
        } else {
            // 加入者是白棋后手
            gameState.myPiece = 'white';
            gameState.myTurn = false;
            console.log('我是加入者，使用白棋后行');
        }
        
        // 发送角色确认信息
        sendData({
            type: 'role-confirm',
            isCreator: isCreator
        });
        
        updateGameInfo();
        initializeBoard();
    });

    conn.on('data', data => {
        handleReceivedData(data);
    });

    conn.on('close', () => {
        updateStatus('对手已断开连接');
        resetGame();
    });

    conn.on('error', err => {
        console.error('数据连接错误:', err);
        updateStatus(`数据连接错误: ${err.message || err}`);
    });
}

// 创建游戏
function createGame() {
    const username = usernameInput.value.trim();
    if (!username) {
        updateStatus('请输入用户名');
        return;
    }
    
    gameState.username = username;
    // 保存用户名
    saveUsername(username);
    // 标记我是创建者
    gameState.isCreator = true;
    connectionInfo.classList.remove('hidden');
    updateStatus('等待对手加入...');
}

// 加入游戏
function joinGame() {
    const username = usernameInput.value.trim();
    if (!username) {
        updateStatus('请输入用户名');
        return;
    }
    
    const remoteId = remoteIdInput.value.trim();
    if (!remoteId) {
        updateStatus('请输入连接ID');
        return;
    }
    
    gameState.username = username;
    // 保存用户名
    saveUsername(username);
    // 标记我是加入者
    gameState.isCreator = false;
    
    try {
        conn = peer.connect(remoteId, {
            metadata: { initiator: false, isCreator: false }
        });
        
        if (conn) {
            updateStatus('正在连接...');
            setupConnection();
        }
    } catch (err) {
        console.error('连接错误:', err);
        updateStatus(`连接错误: ${err.message || err}`);
    }
}

// 发送数据
function sendData(data) {
    if (conn && conn.open) {
        conn.send(data);
    }
}

// 处理接收到的数据
function handleReceivedData(data) {
    console.log('收到数据:', data);
    
    switch(data.type) {
        case 'username':
            gameState.remoteUsername = data.username;
            updateGameInfo();
            break;
            
        case 'role-confirm':
            // 确保角色分配正确 - 两人不能同时是创建者或加入者
            console.log('收到对方角色确认：', data.isCreator ? '创建者(黑棋)' : '加入者(白棋)');
            console.log('我当前的角色是：', gameState.myPiece === 'black' ? '创建者(黑棋)' : '加入者(白棋)');
            
            const myIsCreator = gameState.myPiece === 'black';
            if (data.isCreator && myIsCreator) {
                // 冲突：两人都是创建者（黑棋），随机决定谁是黑棋
                console.log('检测到角色冲突：双方都是黑棋！');
                if (peerId > conn.peer) {
                    gameState.myPiece = 'white';
                    gameState.myTurn = false;
                    console.log('冲突解决：我变为白棋，对方ID:', conn.peer, '我的ID:', peerId);
                } else {
                    console.log('冲突解决：我保持黑棋，对方ID:', conn.peer, '我的ID:', peerId);
                }
                updateGameInfo();
                updateTurnIndicator();
            } else if (!data.isCreator && !myIsCreator) {
                // 冲突：两人都是加入者（白棋），随机决定谁是黑棋
                console.log('检测到角色冲突：双方都是白棋！');
                if (peerId < conn.peer) {
                    gameState.myPiece = 'black';
                    gameState.myTurn = true;
                    console.log('冲突解决：我变为黑棋，对方ID:', conn.peer, '我的ID:', peerId);
                } else {
                    console.log('冲突解决：我保持白棋，对方ID:', conn.peer, '我的ID:', peerId);
                }
                updateGameInfo();
                updateTurnIndicator();
            } else {
                console.log('角色确认：没有冲突，游戏可以开始');
            }
            break;
            
        case 'move':
            handleOpponentMove(data.row, data.col);
            break;
            
        case 'restart-request':
            if (confirm('对手请求重新开始游戏，是否同意？')) {
                resetGameBoard();
                sendData({ type: 'restart-accepted' });
            } else {
                sendData({ type: 'restart-rejected' });
            }
            break;
            
        case 'restart-accepted':
            hideWaitingConfirmation();
            resetGameBoard();
            updateStatus('游戏已重新开始');
            break;
            
        case 'restart-rejected':
            hideWaitingConfirmation();
            updateStatus('对手拒绝了重新开始的请求');
            break;
            
        case 'message':
            updateStatus(`对手: ${data.message}`);
            break;
            
        case 'mouse-over':
            // 显示对手鼠标悬停的虚影
            showOpponentPreview(data.row, data.col);
            break;
            
        case 'mouse-out':
            // 清除对手鼠标移出的虚影
            clearOpponentPreview();
            break;
    }
}

// 初始化棋盘
function initializeBoard() {
    board.innerHTML = '';
    
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.addEventListener('click', () => handleCellClick(row, col));
            
            // 添加鼠标悬停和移出事件，用于显示虚影
            cell.addEventListener('mouseover', () => handleCellMouseOver(row, col, cell));
            cell.addEventListener('mouseout', () => handleCellMouseOut(cell));
            
            board.appendChild(cell);
        }
    }
    
    gameState.gameActive = true;
    gameState.winningCells = [];
    hideWinOverlay();
    updateTurnIndicator();
}

// 处理棋盘点击
function handleCellClick(row, col) {
    // 检查是否是我的回合以及这个位置是否为空
    if (!gameState.myTurn || !gameState.gameActive || gameState.board[row][col] !== null || gameState.gameOver) {
        return;
    }
    
    // 落子
    placePiece(row, col, gameState.myPiece);
    
    // 发送落子信息给对手
    sendData({
        type: 'move',
        row: row,
        col: col
    });
    
    // 清除虚影
    clearOpponentPreview();
    
    // 切换回合
    gameState.myTurn = false;
    updateTurnIndicator();
    
    // 检查是否获胜
    checkWinCondition(row, col, gameState.myPiece);
}

// 处理单元格鼠标悬停事件
function handleCellMouseOver(row, col, cell) {
    // 只有在我的回合并且格子为空时才显示虚影
    if (gameState.myTurn && gameState.gameActive && gameState.board[row][col] === null && !gameState.gameOver) {
        // 添加预览棋子
        if (!cell.querySelector(`.${gameState.myPiece}-piece`)) {
            previewPiece = document.createElement('div');
            previewPiece.classList.add(`${gameState.myPiece}-piece`, 'preview-piece');
            cell.appendChild(previewPiece);
        }
        
        // 记录当前悬停的单元格
        lastMouseOverCell = cell;
        
        // 发送鼠标位置给对手
        sendData({
            type: 'mouse-over',
            row: row,
            col: col
        });
    }
}

// 处理单元格鼠标移出事件
function handleCellMouseOut(cell) {
    // 移除预览棋子
    const preview = cell.querySelector('.preview-piece');
    if (preview) {
        cell.removeChild(preview);
    }
    
    // 重置当前悬停单元格
    lastMouseOverCell = null;
    
    // 通知对手鼠标移出
    sendData({
        type: 'mouse-out'
    });
}

// 显示对手鼠标悬停的虚影
function showOpponentPreview(row, col) {
    // 只有格子为空时才显示虚影
    if (gameState.board[row][col] === null && !gameState.gameOver) {
        const cell = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            // 清除之前的虚影
            clearOpponentPreview();
            
            // 添加对手的预览棋子
            const opponentPiece = gameState.myPiece === 'black' ? 'white' : 'black';
            const preview = document.createElement('div');
            preview.classList.add(`${opponentPiece}-piece`, 'preview-piece', 'opponent-preview');
            cell.appendChild(preview);
        }
    }
}

// 清除对手的棋子虚影
function clearOpponentPreview() {
    const opponentPreviews = document.querySelectorAll('.opponent-preview');
    opponentPreviews.forEach(preview => {
        if (preview.parentNode) {
            preview.parentNode.removeChild(preview);
        }
    });
}

// 处理对手的落子
function handleOpponentMove(row, col) {
    const opponentPiece = gameState.myPiece === 'black' ? 'white' : 'black';
    placePiece(row, col, opponentPiece);
    
    // 清除所有虚影
    clearOpponentPreview();
    
    // 切换回合
    gameState.myTurn = true;
    updateTurnIndicator();
    
    // 检查是否获胜
    checkWinCondition(row, col, opponentPiece);
}

// 在棋盘上放置棋子
function placePiece(row, col, piece) {
    gameState.board[row][col] = piece;
    
    // 更新UI
    const cell = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    
    // 移除任何预览棋子
    const preview = cell.querySelector('.preview-piece');
    if (preview) {
        cell.removeChild(preview);
    }
    
    const pieceElement = document.createElement('div');
    pieceElement.classList.add(`${piece}-piece`);
    cell.appendChild(pieceElement);
}

// 检查获胜条件
function checkWinCondition(row, col, piece) {
    const directions = [
        [0, 1],   // 水平
        [1, 0],   // 垂直
        [1, 1],   // 右下对角线
        [1, -1]   // 左下对角线
    ];
    
    for (const [dx, dy] of directions) {
        let count = 1; // 当前位置已经有一个棋子
        let winningCells = [[row, col]]; // 开始记录可能获胜的棋子位置
        
        // 检查正方向
        for (let i = 1; i < WINNING_COUNT; i++) {
            const newRow = row + i * dx;
            const newCol = col + i * dy;
            
            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                break;
            }
            
            if (gameState.board[newRow][newCol] === piece) {
                count++;
                winningCells.push([newRow, newCol]);
            } else {
                break;
            }
        }
        
        // 检查反方向
        for (let i = 1; i < WINNING_COUNT; i++) {
            const newRow = row - i * dx;
            const newCol = col - i * dy;
            
            if (newRow < 0 || newRow >= BOARD_SIZE || newCol < 0 || newCol >= BOARD_SIZE) {
                break;
            }
            
            if (gameState.board[newRow][newCol] === piece) {
                count++;
                winningCells.push([newRow, newCol]);
            } else {
                break;
            }
        }
        
        // 检查是否已经达到5个连续棋子
        if (count >= WINNING_COUNT) {
            gameState.winningCells = winningCells;
            declareWinner(piece);
            return;
        }
    }
    
    // 检查是否平局
    let isDraw = true;
    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            if (gameState.board[row][col] === null) {
                isDraw = false;
                break;
            }
        }
        if (!isDraw) break;
    }
    
    if (isDraw) {
        declareDraw();
    }
}

// 计算获胜棋子的中心位置
function calculateWinningCenter() {
    if (!gameState.winningCells || gameState.winningCells.length === 0) {
        return { row: BOARD_SIZE / 2, col: BOARD_SIZE / 2 }; // 默认中心
    }

    // 计算获胜棋子的平均位置
    let sumRow = 0, sumCol = 0;
    for (const [row, col] of gameState.winningCells) {
        sumRow += row;
        sumCol += col;
    }
    
    let avgRow = Math.floor(sumRow / gameState.winningCells.length);
    let avgCol = Math.floor(sumCol / gameState.winningCells.length);
    
    return { row: avgRow, col: avgCol };
}

// 根据获胜棋子位置决定胜利界面的位置
function positionWinOverlay() {
    // 移除之前的所有位置类
    winOverlay.classList.remove(
        'win-position-top', 'win-position-middle', 'win-position-bottom',
        'win-position-left', 'win-position-right'
    );
    
    // 计算获胜中心位置
    const { row, col } = calculateWinningCenter();
    
    // 根据行确定垂直位置
    if (row < BOARD_SIZE / 3) {
        winOverlay.classList.add('win-position-bottom'); // 棋子在上部，显示在下部
    } else if (row > (BOARD_SIZE * 2) / 3) {
        winOverlay.classList.add('win-position-top'); // 棋子在下部，显示在上部
    } else {
        winOverlay.classList.add('win-position-middle'); // 棋子在中部，显示在中部但避开
    }
    
    // 根据列确定水平位置
    if (col < BOARD_SIZE / 2) {
        winOverlay.classList.add('win-position-right'); // 棋子在左部，显示在右部
    } else {
        winOverlay.classList.add('win-position-left'); // 棋子在右部，显示在左部
    }
}

// 高亮获胜的棋子并添加连线效果
function highlightWinningCells() {
    // 清除之前的高亮
    document.querySelectorAll('.winning-line').forEach(cell => {
        cell.classList.remove('winning-line');
    });
    
    // 按顺序高亮获胜棋子
    for (let i = 0; i < gameState.winningCells.length; i++) {
        const [row, col] = gameState.winningCells[i];
        const cell = board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        
        if (cell) {
            // 延迟添加高亮效果，形成连续高亮的动画效果
            setTimeout(() => {
                cell.classList.add('winning-line');
                
                // 棋子放大效果
                const piece = cell.querySelector('.black-piece, .white-piece');
                if (piece) {
                    piece.style.transition = 'all 0.3s';
                    piece.style.transform = 'scale(1.2)';
                    
                    // 添加额外的动画效果
                    piece.style.boxShadow = '0 0 15px gold, 0 0 30px gold';
                }
            }, i * 150); // 每个棋子延迟150ms高亮
        }
    }
}

// 切换胜利界面的显示状态
function toggleWinOverlay() {
    if (!winOverlay.classList.contains('hidden')) {
        // 隐藏胜利界面
        hideWinOverlay();
        
        // 添加点击棋盘事件
        board.classList.add('clickable-board');
        board.addEventListener('click', showWinOverlayOnBoardClick);
        
        // 添加提示文本
        addBoardClickHint();
    }
}

// 添加点击棋盘提示
function addBoardClickHint() {
    // 创建提示元素
    const hintElement = document.createElement('div');
    hintElement.className = 'board-click-hint';
    hintElement.innerHTML = '<span>点击棋盘</span>返回';
    hintElement.id = 'board-click-hint';
    
    // 添加到棋盘容器
    document.querySelector('.board-container').appendChild(hintElement);
    
    // 计算提示位置，避开获胜棋子
    positionBoardClickHint(hintElement);
    
    // 淡入显示
    setTimeout(() => {
        hintElement.style.opacity = '1';
    }, 100);
    
    // 5秒后淡出
    setTimeout(() => {
        if (hintElement && hintElement.parentNode) {
            hintElement.style.opacity = '0';
            setTimeout(() => {
                if (hintElement && hintElement.parentNode) {
                    hintElement.parentNode.removeChild(hintElement);
                }
            }, 500);
        }
    }, 5000);
}

// 根据获胜棋子位置放置提示文本
function positionBoardClickHint(hintElement) {
    // 获取棋盘容器尺寸
    const boardContainer = document.querySelector('.board-container');
    const containerRect = boardContainer.getBoundingClientRect();
    
    // 默认位置
    let positionClass = '';
    
    // 计算获胜中心位置
    const { row, col } = calculateWinningCenter();
    
    // 添加对角位置类 - 将棋盘划分为四个象限
    // 优先考虑对角位置，确保最大程度避开获胜棋子
    if (row < BOARD_SIZE / 2) {
        if (col < BOARD_SIZE / 2) {
            // 获胜棋子在左上，提示放在右下
            positionClass = ' hint-bottom hint-right';
        } else {
            // 获胜棋子在右上，提示放在左下
            positionClass = ' hint-bottom hint-left';
        }
    } else {
        if (col < BOARD_SIZE / 2) {
            // 获胜棋子在左下，提示放在右上
            positionClass = ' hint-top hint-right';
        } else {
            // 获胜棋子在右下，提示放在左上
            positionClass = ' hint-top hint-left';
        }
    }
    
    // 应用定位类
    hintElement.className = `board-click-hint${positionClass}`;
}

// 点击棋盘时显示胜利界面
function showWinOverlayOnBoardClick(event) {
    // 防止事件冒泡
    event.stopPropagation();
    
    // 如果点击的是棋子，或者游戏未结束，不处理
    if (!gameState.gameOver) return;
    
    // 移除点击事件
    board.removeEventListener('click', showWinOverlayOnBoardClick);
    board.classList.remove('clickable-board');
    
    // 移除提示元素
    const hintElement = document.getElementById('board-click-hint');
    if (hintElement && hintElement.parentNode) {
        hintElement.parentNode.removeChild(hintElement);
    }
    
    // 显示胜利界面
    showWinOverlay();
}

// 显示胜利覆盖层
function showWinOverlay() {
    winOverlay.classList.remove('hidden');
    // 使胜利覆盖层逐渐从透明变为可见
    winOverlay.style.opacity = '0';
    winOverlay.style.transition = 'opacity 0.5s';
    
    setTimeout(() => {
        winOverlay.style.opacity = '1';
    }, 50);
}

// 隐藏胜利覆盖层
function hideWinOverlay() {
    // 渐变隐藏
    if (!winOverlay.classList.contains('hidden')) {
        winOverlay.style.opacity = '0';
        setTimeout(() => {
            winOverlay.classList.add('hidden');
        }, 500);
    } else {
        winOverlay.classList.add('hidden');
    }
}

// 宣布获胜者
function declareWinner(piece) {
    gameState.gameOver = true;
    gameState.gameActive = false;
    gameState.winner = piece;
    
    const isMyWin = piece === gameState.myPiece;
    const winnerName = isMyWin ? gameState.username : gameState.remoteUsername;
    
    // 先更新状态
    updateStatus(`${winnerName} 获胜！`);
    restartBtn.disabled = false;
    
    // 高亮获胜的棋子
    highlightWinningCells();
    
    // 准备获胜消息
    winMessage.textContent = `${winnerName} 获胜！`;
    
    // 等待高亮动画完成后显示获胜覆盖层
    setTimeout(() => {
        // 根据获胜棋子位置调整胜利界面
        positionWinOverlay();
        showWinOverlay();
    }, gameState.winningCells.length * 150 + 300); // 所有棋子高亮后再等300ms
}

// 宣布平局
function declareDraw() {
    gameState.gameOver = true;
    gameState.gameActive = false;
    
    // 显示平局消息
    winMessage.textContent = '游戏平局！';
    
    // 平局时放在中间位置
    winOverlay.classList.remove(
        'win-position-top', 'win-position-middle', 'win-position-bottom',
        'win-position-left', 'win-position-right'
    );
    winOverlay.classList.add('win-position-middle');
    showWinOverlay();
    
    updateStatus('游戏平局！');
    restartBtn.disabled = false;
}

// 重置游戏
function resetGame() {
    conn = null;
    gameState = {
        board: Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null)),
        currentPlayer: 'black',
        myPiece: null,
        myTurn: false,
        username: gameState.username,
        remoteUsername: '',
        gameActive: false,
        gameOver: false,
        winner: null,
        isCreator: undefined,
        winningCells: []
    };
    
    // 移除点击棋盘事件
    board.removeEventListener('click', showWinOverlayOnBoardClick);
    board.classList.remove('clickable-board');
    
    // 移除提示元素
    const hintElement = document.getElementById('board-click-hint');
    if (hintElement && hintElement.parentNode) {
        hintElement.parentNode.removeChild(hintElement);
    }
    
    // 重置等待状态
    hideWaitingConfirmation();
    newGameBtn.disabled = false;
    newGameBtn.classList.remove('waiting');
    
    setupPanel.classList.remove('hidden');
    gameContainer.classList.add('hidden');
    connectionInfo.classList.add('hidden');
    hideWinOverlay();
    
    createBtn.disabled = false;
    joinBtn.disabled = false;
    restartBtn.disabled = true;
}

// 重置游戏棋盘
function resetGameBoard() {
    gameState.board = Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill(null));
    gameState.gameOver = false;
    gameState.winner = null;
    gameState.gameActive = true;
    gameState.winningCells = [];
    
    // 移除点击棋盘事件
    board.removeEventListener('click', showWinOverlayOnBoardClick);
    board.classList.remove('clickable-board');
    
    // 移除提示元素
    const hintElement = document.getElementById('board-click-hint');
    if (hintElement && hintElement.parentNode) {
        hintElement.parentNode.removeChild(hintElement);
    }
    
    // 重置等待状态
    hideWaitingConfirmation();
    newGameBtn.disabled = false;
    newGameBtn.classList.remove('waiting');
    
    // 重置回合(黑棋先走)
    gameState.myTurn = gameState.myPiece === 'black';
    
    initializeBoard();
    hideWinOverlay();
    updateStatus('游戏已重新开始');
    restartBtn.disabled = true;
}

// 请求重新开始游戏
function requestRestart() {
    // 发送重新开始请求
    sendData({ type: 'restart-request' });
    
    // 更新状态消息
    updateStatus('已发送重新开始请求，等待对手回应...');
    
    // 显示等待对方确认的提示
    showWaitingConfirmation();
    
    // 仅禁用按钮和添加等待样式，但保持文本不变
    newGameBtn.disabled = true;
    newGameBtn.classList.add('waiting');
    restartBtn.disabled = true;
}

// 显示等待确认提示
function showWaitingConfirmation() {
    // 创建或获取等待提示元素
    let waitingElement = document.getElementById('waiting-confirmation');
    if (!waitingElement) {
        waitingElement = document.createElement('div');
        waitingElement.id = 'waiting-confirmation';
        waitingElement.className = 'waiting-confirmation';
        waitingElement.innerHTML = '<div class="spinner"></div><p>等待对方确认重新开始...</p>';
        document.querySelector('.win-message-container').appendChild(waitingElement);
    } else {
        waitingElement.classList.remove('hidden');
    }
}

// 隐藏等待确认提示
function hideWaitingConfirmation() {
    const waitingElement = document.getElementById('waiting-confirmation');
    if (waitingElement) {
        waitingElement.classList.add('hidden');
    }
    
    // 重置按钮状态，但不修改文本
    newGameBtn.disabled = false;
    newGameBtn.classList.remove('waiting');
}

// 更新游戏信息
function updateGameInfo() {
    localPlayerName.textContent = gameState.username;
    remotePlayerName.textContent = gameState.remoteUsername || '等待中...';
    
    if (gameState.myPiece) {
        localPlayerPiece.textContent = gameState.myPiece === 'black' ? '(黑棋)' : '(白棋)';
        remotePlayerPiece.textContent = gameState.myPiece === 'black' ? '(白棋)' : '(黑棋)';
    }
}

// 更新回合提示
function updateTurnIndicator() {
    if (gameState.gameOver) {
        if (gameState.winner) {
            const winnerName = gameState.winner === gameState.myPiece ? gameState.username : gameState.remoteUsername;
            turnIndicator.textContent = `${winnerName} 获胜！`;
        } else {
            turnIndicator.textContent = '游戏平局！';
        }
    } else if (!gameState.gameActive) {
        turnIndicator.textContent = '等待连接...';
    } else if (gameState.myTurn) {
        turnIndicator.textContent = '轮到你走棋';
    } else {
        turnIndicator.textContent = '等待对方走棋';
    }
}

// 更新状态消息
function updateStatus(message) {
    statusMessage.textContent = message;
    console.log(message);
}

// 复制连接ID到剪贴板
function copyConnectionId() {
    navigator.clipboard.writeText(peerId)
        .then(() => {
            updateStatus('连接ID已复制到剪贴板');
        })
        .catch(err => {
            console.error('复制失败:', err);
            updateStatus('复制ID失败，请手动复制');
        });
}

// 事件监听器
window.addEventListener('load', () => {
    initializePeer();
    
    // 加载保存的用户名
    loadUsername();
    
    createBtn.addEventListener('click', createGame);
    joinBtn.addEventListener('click', joinGame);
    copyIdBtn.addEventListener('click', copyConnectionId);
    restartBtn.addEventListener('click', requestRestart);
    leaveBtn.addEventListener('click', resetGame);
    newGameBtn.addEventListener('click', requestRestart);
    toggleWinOverlayBtn.addEventListener('click', toggleWinOverlay);
});

// 在开发环境中，离开页面前警告
window.addEventListener('beforeunload', e => {
    if (conn && conn.open) {
        // 设置一个通用的提示消息
        const message = '您仍在游戏中，离开将断开连接。确定要离开吗？';
        e.preventDefault();
        // 现代浏览器不再显示自定义消息，但设置它可以确保显示确认对话框
        return message;
    }
}); 