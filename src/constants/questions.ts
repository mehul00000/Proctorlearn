import { ModuleId, Question } from '../types';

export const MOCK_QUESTIONS: Record<ModuleId, Question[]> = {
  'aptitude': [
    { id: 'apt_1', text: "If 5 machines can make 5 widgets in 5 minutes, how long would it take 100 machines to make 100 widgets?", options: ["100 minutes", "5 minutes", "20 minutes", "1 minute"], correctAnswer: 1 },
    { id: 'apt_2', text: "A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How much does the ball cost?", options: ["$0.10", "$0.05", "$0.15", "$0.01"], correctAnswer: 1 },
    { id: 'apt_3', text: "All roses are flowers. Some flowers fade quickly. Therefore, some roses fade quickly.", options: ["True", "False", "Cannot be determined", "None of the above"], correctAnswer: 1 },
    { id: 'apt_4', text: "Which number comes next in the series: 2, 6, 12, 20, 30, ...?", options: ["36", "40", "42", "48"], correctAnswer: 2 },
    { id: 'apt_5', text: "A man is 24 years older than his son. In two years, his age will be twice the age of his son. The present age of his son is:", options: ["14 years", "18 years", "20 years", "22 years"], correctAnswer: 3 },
    { id: 'apt_6', text: "If 'LIGHT' is coded as 'MJHIT', how is 'DARK' coded?", options: ["EBSL", "EBTL", "ECSL", "EDSL"], correctAnswer: 0 }
  ],
  'dsa': [
    { id: 'dsa_1', text: "What is the time complexity of searching for an element in a balanced Binary Search Tree?", options: ["O(1)", "O(n)", "O(log n)", "O(n log n)"], correctAnswer: 2 },
    { id: 'dsa_2', text: "Which data structure uses the LIFO (Last In First Out) principle?", options: ["Queue", "Stack", "Linked List", "Heap"], correctAnswer: 1 },
    { id: 'dsa_3', text: "What is the space complexity of a recursive Fibonacci function without memoization?", options: ["O(1)", "O(n)", "O(2^n)", "O(log n)"], correctAnswer: 2 },
    { id: 'dsa_4', text: "Which sorting algorithm has the best worst-case time complexity?", options: ["Bubble Sort", "Selection Sort", "Merge Sort", "Quick Sort"], correctAnswer: 2 },
    { id: 'dsa_5', text: "In a doubly linked list, how many pointers does each node have?", options: ["1", "2", "3", "0"], correctAnswer: 1 },
    { id: 'dsa_6', text: "What is the maximum number of children a node in a binary tree can have?", options: ["1", "2", "3", "Unlimited"], correctAnswer: 1 }
  ],
  'dbms': [
    { id: 'db_1', text: "Which SQL clause is used to filter results after an aggregation?", options: ["WHERE", "HAVING", "GROUP BY", "ORDER BY"], correctAnswer: 1 },
    { id: 'db_2', text: "What does ACID stand for in database transactions?", options: ["Atomicity, Consistency, Isolation, Durability", "Accuracy, Consistency, Integrity, Durability", "Atomicity, Clarity, Isolation, Data", "Access, Control, Integrity, Durability"], correctAnswer: 0 },
    { id: 'db_3', text: "Which normal form deals with multi-valued dependencies?", options: ["1NF", "2NF", "3NF", "4NF"], correctAnswer: 3 },
    { id: 'db_4', text: "Which of the following is NOT a type of SQL join?", options: ["INNER JOIN", "OUTER JOIN", "CROSS JOIN", "SIDE JOIN"], correctAnswer: 3 },
    { id: 'db_5', text: "What is a primary key?", options: ["A key that can be null", "A unique identifier for a record", "A key that refers to another table", "A key used for encryption"], correctAnswer: 1 },
    { id: 'db_6', text: "Which command is used to remove all records from a table without deleting the table structure?", options: ["DELETE", "DROP", "TRUNCATE", "REMOVE"], correctAnswer: 2 }
  ],
  'cs-core': [
    { id: 'cs_1', text: "Which layer of the OSI model is responsible for routing?", options: ["Data Link", "Transport", "Network", "Session"], correctAnswer: 2 },
    { id: 'cs_2', text: "What is a deadlock in Operating Systems?", options: ["A process that never finishes", "A situation where two or more processes are waiting for each other", "A process that consumes too much memory", "A process that is terminated by the user"], correctAnswer: 1 },
    { id: 'cs_3', text: "Which OOP principle allows a class to inherit properties from another class?", options: ["Encapsulation", "Polymorphism", "Abstraction", "Inheritance"], correctAnswer: 3 },
    { id: 'cs_4', text: "What is the main function of the ARP protocol?", options: ["Resolving IP to MAC", "Resolving MAC to IP", "Routing packets", "Error reporting"], correctAnswer: 0 },
    { id: 'cs_5', text: "Which scheduling algorithm is non-preemptive?", options: ["Round Robin", "Shortest Job First", "Priority Scheduling", "Multilevel Queue"], correctAnswer: 1 },
    { id: 'cs_6', text: "What is a 'thread' in an operating system?", options: ["A heavy-weight process", "A light-weight process", "A type of memory", "A network protocol"], correctAnswer: 1 }
  ]
};
